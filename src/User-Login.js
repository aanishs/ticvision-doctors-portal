import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc, query, where, getDocs, updateDoc, collection } from "firebase/firestore";

const UserLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ Step 1: Extract Token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const confirmationToken = urlParams.get("token");

  // ✅ Handle Email/Password Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ✅ Step 3: If token exists, confirm patient request
      if (confirmationToken) {
        await confirmPatientRequest(confirmationToken);
      } else {
        navigate("/success");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // ✅ Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if the user already exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // If new user, add to Firestore
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          createdAt: new Date(),
        });
      }

      // ✅ Step 3: If token exists, confirm patient request
      if (confirmationToken) {
        await confirmPatientRequest(confirmationToken);
      } else {
        navigate("/success");
      }
    } catch (error) {
      setError(error.message);
    }
  };

  // ✅ Step 2: Confirm Patient Request in Firestore
  const confirmPatientRequest = async (token) => {
    try {
      // Find the pending request with the token
      const requestQuery = query(collection(db, "pending_requests"), where("token", "==", token));
      const querySnapshot = await getDocs(requestQuery);

      if (querySnapshot.empty) {
        console.error("❌ Invalid or expired token.");
        return;
      }

      const requestDoc = querySnapshot.docs[0];
      const requestData = requestDoc.data();

      // ✅ Step 4: Mark patient as confirmed
      await setDoc(doc(db, "doctors", requestData.doctorId, "patients", requestData.patientId), {
        patientId: requestData.patientId,
        confirmedAt: new Date(),
      });

      // ✅ Step 5: Update request as confirmed
      await updateDoc(requestDoc.ref, { confirmed: true });

      console.log("✅ Patient confirmed successfully!");
      navigate("/success");
    } catch (error) {
      console.error("❌ Error confirming patient:", error);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card p-4 shadow" style={{ width: "400px" }}>
      <div className="text-center">
        <h3>User Login</h3>
        <img
          src="/ticvision-logo.png"
          alt="TicVision Logo"
          width="150"
          className="mb-6 mx-auto block"
        />
      </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            Login
          </button>
          <button
            type="button"
            className="btn btn-danger w-100 mt-2"
            onClick={handleGoogleSignIn}
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserLogin;
