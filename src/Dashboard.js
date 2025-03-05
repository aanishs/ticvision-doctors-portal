import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { collection, doc, getDocs, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [patients, setPatients] = useState([]);
  const [doctorId, setDoctorId] = useState(null);
  const [confirmationLink, setConfirmationLink] = useState("");

  // ✅ Persist Authentication Across Refreshes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("✅ Authenticated doctor:", user.uid);
        setDoctorId(user.uid);
        fetchPatients(user.uid);
      } else {
        console.error("❌ No authenticated doctor found.");
        setDoctorId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // ✅ Fetch Patients from Firestore
  const fetchPatients = async (docId = doctorId) => {
    if (!docId) {
      console.error("❌ Doctor ID is missing, cannot fetch patients.");
      return;
    }

    try {
      console.log("🔍 Fetching patients for doctor:", docId);
      const patientsRef = collection(db, `doctors/${docId}/patients`);
      const patientDocs = await getDocs(patientsRef);

      console.log("📂 Fetched patient documents:", patientDocs.docs.length);
      if (patientDocs.empty) {
        console.warn("⚠️ No patients found for this doctor.");
        setPatients([]);
        return;
      }

      const patientData = await Promise.all(
        patientDocs.docs.map(async (docSnap) => {
          const patientId = docSnap.id;
          console.log("🆔 Found patient ID:", patientId);

          const userRef = doc(db, "users", patientId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log("👤 Patient Data:", userData);

            return {
              id: patientId,
              displayName: userData.displayName || "Unknown",
              ticCounter: userData.ticCounter || 0,
            };
          } else {
            console.warn("⚠️ No user found with ID:", patientId);
            return null;
          }
        })
      );

      setPatients(patientData.filter((p) => p !== null));
    } catch (error) {
      console.error("❌ Error fetching patients:", error);
    }
  };

  // ✅ Add a Patient
  const addPatient = async () => {
    if (!email || !doctorId) return;

    try {
      const idToken = await auth.currentUser.getIdToken();

      console.log("📩 Sending patient confirmation request for:", email);
      const response = await fetch(
        "https://us-central1-ticvision.cloudfunctions.net/generatePatientConfirmation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ doctorId, patientEmail: email }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Server Response:", result);

      setMessage("Confirmation email generated.");
      setConfirmationLink(result.confirmationLink); // ✅ Get only the link
      setEmail("");
      fetchPatients(); // ✅ Refresh List
    } catch (error) {
      setMessage("Error: " + error.message);
      console.error("❌ Error adding patient:", error);
    }
  };

  // ✅ Construct Email Template on Frontend
  const emailTemplate = confirmationLink
    ? `Subject: Confirm Doctor Access to Your TicVision Data
    
Hello,

A doctor would like to add you as a patient on TicVision to track your tic history and provide better insights.

To confirm this, please click the link below:

${confirmationLink}

If you did not request this, you can ignore this message.

Best,  
TicVision Team`
    : "";

  // ✅ Copy Email to Clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailTemplate);
    alert("Copied to clipboard!");
  };

  // ✅ Send Email via Default Email App
  const sendViaEmail = () => {
    window.location.href = `mailto:?subject=Confirm Doctor Access to Your TicVision Data&body=${encodeURIComponent(
      emailTemplate
    )}`;
  };

  return (
    <div className="container mt-5">
      <h2>Doctor's Dashboard</h2>

      {/* ✅ Add Patient Input */}
      <input
        type="email"
        className="form-control mb-2"
        placeholder="Enter patient email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="btn btn-primary" onClick={addPatient}>
        Add Patient
      </button>
      <button className="btn btn-secondary ms-2" onClick={() => fetchPatients()}>
        Refresh List
      </button>
      {message && <p className="mt-3">{message}</p>}

      {/* ✅ Display Email Confirmation Template */}
      {confirmationLink && (
        <div className="mt-4 p-3 border rounded bg-light">
          <h5>Confirmation Email:</h5>
          <textarea
            className="form-control mb-2"
            rows="5"
            value={emailTemplate}
            readOnly
          />
          <button className="btn btn-outline-primary me-2" onClick={copyToClipboard}>
            Copy
          </button>
          <button className="btn btn-outline-secondary" onClick={sendViaEmail}>
            Send via Email
          </button>
        </div>
      )}

      {/* ✅ Display Patients Table */}
      <h3 className="mt-5">Patients List</h3>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Patient Name</th>
            <th>Tic Counter</th>
          </tr>
        </thead>
        <tbody>
          {patients.length > 0 ? (
            patients.map((patient) => (
              <tr key={patient.id}>
                <td>
                  <Link to={`/patients/${patient.id}`} className="text-primary">
                    {patient.displayName}
                  </Link>
                </td>
                <td>{patient.ticCounter}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="2" className="text-center">No patients added yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
