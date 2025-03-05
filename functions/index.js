const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();
const { v4: uuidv4 } = require("uuid");

const corsHandler = cors({ origin: true });

// ✅ Function to Generate Confirmation Link
exports.generatePatientConfirmation = onRequest(
  { invoker: ["public"] }, // Allow public access
  async (req, res) => {
    corsHandler(req, res, async () => {
      console.log("📨 Function triggered: generatePatientConfirmation");

      try {
        const { doctorId, patientEmail } = req.body;
        if (!doctorId || !patientEmail) {
          console.error("❌ Missing doctorId or patientEmail.");
          return res.status(400).json({ error: "Missing doctorId or patientEmail." });
        }

        console.log("🔍 Checking if patient exists:", patientEmail);

        // ✅ Step 1: Check if user exists in Firestore
        const userQuery = await db.collection("users").where("email", "==", patientEmail).get();
        if (userQuery.empty) {
          console.error("❌ Patient not found:", patientEmail);
          return res.status(404).json({ error: "Patient not found." });
        }

        const patientDoc = userQuery.docs[0];
        const patientId = patientDoc.id;
        console.log("✅ Found patient:", patientId);

        // ✅ Step 2: Generate confirmation link
        const confirmationLink = `https://us-central1-ticvision.cloudfunctions.net/confirmPatientRequest?doctorId=${doctorId}&patientId=${patientId}`;
        console.log("🔗 Confirmation Link:", confirmationLink);

        // ✅ Step 3: Save Pending Request
        await db.collection("pending_requests").add({
          doctorId,
          patientId,
          patientEmail,
          confirmed: false,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("✅ Request saved in Firestore.");

        // ✅ Step 4: Generate Email Template
        const emailTemplate = {
          subject: "Confirm Doctor Access to Your TicVision Data",
          body: `A doctor wants to add you as a patient on TicVision.
          Click the link below to confirm your access:
          ${confirmationLink}

          If you did not request this, please ignore this email.
          `,
        };

        // ✅ Step 5: Return Confirmation Link & Email Template
        return res.status(200).json({
          success: true,
          confirmationLink,
          emailTemplate,
        });

      } catch (error) {
        console.error("❌ Error in function:", error);
        return res.status(500).json({ error: "Server error: " + error.message });
      }
    });
  }
);


exports.confirmPatientRequest = onRequest(
  { invoker: ["public"] }, // Allow public access
  async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const { doctorId, patientId } = req.query;

        if (!doctorId || !patientId) {
          return res.status(400).send("Invalid confirmation link.");
        }

        // ✅ Step 1: Check if request exists
        const requestQuery = await db
          .collection("pending_requests")
          .where("doctorId", "==", doctorId)
          .where("patientId", "==", patientId)
          .where("confirmed", "==", false)
          .get();

        if (requestQuery.empty) {
          return res.status(400).send("Request not found or already confirmed.");
        }

        // ✅ Step 2: Generate a Unique Token
        const token = uuidv4();
        const requestDoc = requestQuery.docs[0];

        // ✅ Step 3: Store the token in Firestore (so we verify later)
        await db.collection("pending_requests").doc(requestDoc.id).update({
          token,
        });

        console.log(`🔗 Redirecting user to login with token: ${token}`);

        // ✅ Step 4: Redirect user to `/userlogin` with the token
        return res.redirect(`http://localhost:3000/userlogin?token=${token}`);
      } catch (error) {
        console.error("❌ Error in confirmPatientRequest:", error);
        return res.status(500).send("Error confirming patient: " + error.message);
      }
    });
  }
);

