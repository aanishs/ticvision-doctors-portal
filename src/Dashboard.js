import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { collection, doc, getDocs, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import TextareaAutosize from "react-textarea-autosize";

const Dashboard = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [patients, setPatients] = useState([]);
  const [doctorId, setDoctorId] = useState(null);
  const [confirmationLink, setConfirmationLink] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

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

    setEmailLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();

      console.log("📩 Sending patient confirmation request for:", email);
      const response = await fetch(
        "https://us-central1-ticvision.cloudfunctions.net/generatePatientConfirmation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ doctorId, patientEmail: email }),
        }
      );

      if (!response.ok) {
        throw new Error(`User with given email not found`);
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
    } finally {
      setEmailLoading(false);
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
    <div className="max-w-5xl mx-auto p-4">
      <h2 className="text-3xl font-bold mb-6">Doctor&apos;s Dashboard</h2>

      {/* ✅ Add Patient Input */}
      <div className="mb-4">
        <input
          type="email"
          className="w-full border border-gray-300 p-3 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Enter patient email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex space-x-3">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            onClick={addPatient}
          >
            Add Patient
          </button>
          <button
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            onClick={() => fetchPatients()}
          >
            Refresh List
          </button>
        </div>
        {message && <p className="mt-3 text-green-600">{message}</p>}
      </div>

      {/* ✅ Display Email Confirmation Template */}
      {emailLoading ? (
        <div className="mt-4 p-4 border border-gray-200 rounded bg-gray-50 flex items-center justify-center">
          <svg
            className="animate-spin h-6 w-6 text-blue-500 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          <span className="text-blue-500 font-medium">Generating email template...</span>
        </div>
      ) : confirmationLink ? (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h5 className="text-lg font-semibold mb-2">Confirmation Email:</h5>
          <TextareaAutosize
            className="w-full border border-gray-300 p-3 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={emailTemplate}
            readOnly
          />
          <div className="flex space-x-3 mt-2">
            <button
              className="border border-blue-500 text-blue-500 px-4 py-2 rounded hover:bg-blue-50 transition-colors duration-200"
              onClick={copyToClipboard}
            >
              Copy
            </button>
            <button
              className="border border-gray-500 text-gray-500 px-4 py-2 rounded hover:bg-gray-50 transition-colors duration-200"
              onClick={sendViaEmail}
            >
              Send via Email
            </button>
          </div>
        </div>
      ) : null}

      {/* ✅ Display Patients Table */}
      <h3 className="mt-8 text-2xl font-semibold">Patients List</h3>
      <div className="mt-4 shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
              >
                Patient Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
              >
                Tic Counter
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {patients.length > 0 ? (
              patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/patients/${patient.id}`} className="text-gray-600 hover:underline">
                      {patient.displayName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{patient.ticCounter}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="px-6 py-4 text-center text-gray-500">
                  No patients added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
