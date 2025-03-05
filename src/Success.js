import React from "react";
import { motion } from "framer-motion";

const SuccessScreen = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white">
      {/* Animated Checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 12 }}
        className="flex items-center justify-center w-20 h-20 bg-green-500 rounded-full shadow-lg"
      >
        <motion.svg
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8 }}
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </motion.svg>
      </motion.div>

      {/* Success Text */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-4 text-2xl font-semibold text-gray-800"
      >
        Success
      </motion.p>
    </div>
  );
};

export default SuccessScreen;
