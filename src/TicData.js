import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { collection, getDocs } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { auth, db } from "./firebase"; // Adjust paths as needed
import { Chart } from "react-google-charts";
import { ArrowUpDown } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // Import the XLSX library
import "./ticData.css";

// Chart modes
const chartModes = ["avg", "total", "count"];

// Time Range Keys
const timeRanges = {
  all: "All Time",
  today: "Today",
  lastWeek: "Last Week",
  lastMonth: "Last Month",
  last3Months: "Last 3 Months",
  last6Months: "Last 6 Months",
  lastYear: "Last Year",
  specificDate: "Specific Date",
};

const TicData = () => {
  // ---- STATES ----
  const { patientId } = useParams();
  const [ticData, setTicData] = useState([]);
  const [myTics, setMyTics] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // FILTER STATES
  const [timeRangeFilter, setTimeRangeFilter] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [locationFilter, setLocationFilter] = useState([]);

  // SORT DIRECTION FOR TABLE
  const [sortDirection, setSortDirection] = useState("desc");

  // CHART MODE
  const [chartModeIndex, setChartModeIndex] = useState(0);
  const currentChartMode = chartModes[chartModeIndex];

  // ---- EFFECTS ----
  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  // ---- DATA FETCH ----
  const fetchData = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error("No authenticated user found.");
      return;
    }

    setLoading(true);

    try {
      if (!patientId) return;
      const historyCollection = collection(db, "users", patientId, "ticHistory");
      const snapshot = await getDocs(historyCollection);
      const rawData = snapshot.docs.map((doc) => {
        const docData = doc.data();
        return {
          timeOfDay: docData.timeOfDay,
          date: docData.date,
          intensity: docData.intensity,
          location: docData.location,
        };
      });

      // Fetch myTics (for colors, etc.)
      const myTicsCollection = collection(db, "users", patientId, "mytics");
      const myTicsSnap = await getDocs(myTicsCollection);
      const tics = myTicsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          name: data.name,
          count: data.count,
          color: `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`,
        };
      });

      setTicData(rawData);
      setMyTics(tics);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- FILTERING ----
  const filteredData = useMemo(() => {
    const now = new Date();
    let data = [...ticData];

    // Time range filter
    if (timeRangeFilter !== "specificDate") {
      data = data.filter((tic) => {
        const ticDate = new Date(tic.date);
        switch (timeRangeFilter) {
          case "today":
            return ticDate.toDateString() === now.toDateString();
          case "lastWeek":
            return now.getTime() - ticDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
          case "lastMonth":
            return (
              ticDate.getMonth() === now.getMonth() &&
              ticDate.getFullYear() === now.getFullYear()
            );
          case "last3Months":
            return now.getTime() - ticDate.getTime() <= 90 * 24 * 60 * 60 * 1000;
          case "last6Months":
            return now.getTime() - ticDate.getTime() <= 180 * 24 * 60 * 60 * 1000;
          case "lastYear":
            return ticDate.getFullYear() === now.getFullYear();
          case "all":
          default:
            return true;
        }
      });
    } else if (specificDate) {
      const selDateStr = new Date(specificDate).toDateString();
      data = data.filter(
        (tic) => new Date(tic.date).toDateString() === selDateStr
      );
    }

    // Location filter
    if (locationFilter.length > 0) {
      data = data.filter((tic) => locationFilter.includes(tic.location));
    }

    // Sort (date asc or desc)
    data.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
    });

    return data;
  }, [ticData, timeRangeFilter, specificDate, locationFilter, sortDirection]);

  // Distinct locations
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(ticData.map((t) => t.location)));
  }, [ticData]);

  // Table sort toggle
  const toggleSort = () => {
    const newDirection = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(newDirection);
  };

  // Reset filters
  const handleResetFilters = () => {
    setTimeRangeFilter("all");
    setSpecificDate("");
    setLocationFilter([]);
    setSortDirection("desc");
  };

  // Toggle location
  const toggleLocation = (location) => {
    setLocationFilter((prev) =>
      prev.includes(location)
        ? prev.filter((loc) => loc !== location)
        : [...prev, location]
    );
  };

  // Chart mode switch
  const renderModeLabel = (mode) => {
    switch (mode) {
      case "avg":
        return "Average Intensity";
      case "total":
        return "Total Intensity";
      case "count":
        return "Number of Tics";
      default:
        return "";
    }
  };

  const prevMode = () => {
    setChartModeIndex((prev) => (prev + chartModes.length - 1) % chartModes.length);
  };

  const nextMode = () => {
    setChartModeIndex((prev) => (prev + 1) % chartModes.length);
  };

  // ---- CHART DATA PROCESSING ----
  const processChartData = (data) => {
    const groupingByTimeOfDay = timeRangeFilter === "today";
    const grouped = {};

    data.forEach((tic) => {
      const key = groupingByTimeOfDay ? tic.timeOfDay : tic.date;
      if (!grouped[key]) grouped[key] = {};
      if (!grouped[key][tic.location]) {
        grouped[key][tic.location] = { sum: 0, count: 0 };
      }
      grouped[key][tic.location].sum += tic.intensity;
      grouped[key][tic.location].count += 1;
    });

    const result = Object.entries(grouped).map(([timeKey, locationMap]) => {
      const row = { timeKey };
      Object.entries(locationMap).forEach(([loc, { sum, count }]) => {
        switch (currentChartMode) {
          case "avg":
            row[loc] = sum / count;
            break;
          case "total":
            row[loc] = sum;
            break;
          case "count":
            row[loc] = count;
            break;
          default:
            break;
        }
      });
      return row;
    });

    // Sort by date or timeOfDay
    result.sort((a, b) => {
      if (groupingByTimeOfDay) {
        const timeA = new Date(`2000-01-01 ${a.timeKey}`).getTime();
        const timeB = new Date(`2000-01-01 ${b.timeKey}`).getTime();
        return timeA - timeB;
      } else {
        const dateA = new Date(a.timeKey).getTime();
        const dateB = new Date(b.timeKey).getTime();
        return dateA - dateB;
      }
    });

    return result;
  };

  const chartRawData = useMemo(() => {
    return processChartData(filteredData);
  }, [filteredData, currentChartMode, timeRangeFilter]);

  // Build chart header => ["Time", location1, location2, ...]
  const allLocationsInChart = useMemo(() => {
    const setLoc = new Set();
    chartRawData.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "timeKey") setLoc.add(k);
      });
    });
    return Array.from(setLoc);
  }, [chartRawData]);

  // Assign colors
  const colorMap = useMemo(() => {
    const map = {};
    const randomColor = () =>
      `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;

    allLocationsInChart.forEach((loc) => {
      const matchedTic = myTics.find((t) => t.name === loc);
      if (matchedTic) {
        map[loc] = matchedTic.color;
      } else {
        if (!map[loc]) {
          map[loc] = randomColor();
        }
      }
    });
    return map;
  }, [allLocationsInChart, myTics]);

  // Final 2D array for Google Chart
  const chartDataForGoogle = useMemo(() => {
    if (!chartRawData.length) return [["Time"]];

    const header = ["Time", ...allLocationsInChart];
    const rows = chartRawData.map((entry) => {
      const row = [entry.timeKey];
      allLocationsInChart.forEach((loc) => {
        row.push(entry[loc] || 0);
      });
      return row;
    });
    return [header, ...rows];
  }, [chartRawData, allLocationsInChart]);

  // Find max data value for Y-axis limit
  const findMaxValue = (data) => {
    let maxVal = 0;
    for (let i = 1; i < data.length; i++) {
      for (let j = 1; j < data[i].length; j++) {
        const val = data[i][j];
        if (typeof val === "number" && val > maxVal) {
          maxVal = val;
        }
      }
    }
    return maxVal;
  };

  const maxDataValue = findMaxValue(chartDataForGoogle);
  const chartMax = currentChartMode === "avg" ? 10 : Math.max(maxDataValue + 5, 5);

  const chartOptions = {
    curveType: "function",
    legend: { position: "bottom" },
    hAxis: {
      slantedText: false,
    },
    vAxis: {
      viewWindow: {
        min: 0,
        max: chartMax,
      },
    },
    colors: allLocationsInChart.map((loc) => colorMap[loc]),
  };

  // ---- EXPORT FUNCTIONS ----
  const exportToCSV = () => {
    // Define a header row
    const header = ["Date", "Time of Day", "Location", "Intensity"];
    const csvRows = [];
    csvRows.push(header.join(","));

    // Create a row for each tic in filteredData
    filteredData.forEach((tic) => {
      const row = [
        new Date(tic.date).toLocaleDateString(),
        tic.timeOfDay,
        tic.location,
        tic.intensity,
      ];
      csvRows.push(row.join(","));
    });
    const csvData = csvRows.join("\n");
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", "tic_data.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportToExcel = () => {
    // Convert filteredData to a worksheet. You can modify the keys or order if desired.
    const worksheet = XLSX.utils.json_to_sheet(filteredData, {
      header: ["date", "timeOfDay", "location", "intensity"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TicData");
    // This will prompt the browser to download the Excel file
    XLSX.writeFile(workbook, "tic_data.xlsx");
  };

  // ---- MOBILE SORT BUTTON COMPONENT ----
  const MobileSortButton = ({ onSortClick, sortDirection }) => {
    return (
      <div className="block md:hidden mb-4 text-right">
        <button
          onClick={onSortClick}
          className="p-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors duration-200"
          title={`Sort by date (${sortDirection === "desc" ? "newest first" : "oldest first"})`}
        >
          Sort by Date
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="inline-block ml-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M7 7l3-3m0 0l3 3m-3-3v18" strokeWidth={2} />
          </svg>
        </button>
      </div>
    );
  };

  // ---- RENDER ----
  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <motion.div
        className="container mx-auto max-w-screen-xl w-full overflow-auto px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* TITLE */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-gray-200 rounded-full"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h2 className="text-3xl text-gray-700 sm:text-4xl font-bold">
            Patient Tic Data
          </h2>
        </div>

        {/* FILTERS */}
        <motion.div
          className="bg-white rounded shadow p-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-xl mb-4 font-semibold">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="timeRange">
                Time Range
              </label>
              <select
                id="timeRange"
                className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={timeRangeFilter}
                onChange={(e) => setTimeRangeFilter(e.target.value)}
              >
                {Object.entries(timeRanges).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {/* Specific Date Picker */}
            {timeRangeFilter === "specificDate" && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <label className="block text-sm font-medium mb-1" htmlFor="specificDate">
                  Select Date
                </label>
                <input
                  type="date"
                  id="specificDate"
                  className="border rounded p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                />
              </motion.div>
            )}
            {/* Location Filter (Tic Types) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Tic Types
              </label>
              <div className="flex flex-wrap gap-2">
                {uniqueLocations.map((loc, index) => {
                  const isSelected = locationFilter.includes(loc);
                  return (
                    <motion.button
                      key={loc}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      type="button"
                      onClick={() => toggleLocation(loc)}
                      className={`px-3 py-1 rounded-full border text-sm transition-colors duration-200 ${
                        isSelected
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {loc}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-gray-100 hover:bg-gray-200 transition-colors duration-200 rounded px-3 py-2 text-sm"
            onClick={handleResetFilters}
          >
            Reset Filters
          </motion.button>
        </motion.div>

        {/* LOADING SPINNER */}
        {loading && (
          <motion.div
            className="text-center py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Loading...
          </motion.div>
        )}

        {/* CHART + TABLE */}
        {!loading && (
          <>
            {/* CHART CARD */}
            <motion.div
              className="bg-white rounded shadow p-4 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <button
                  onClick={prevMode}
                  className="p-2 hover:bg-gray-100 rounded transition-colors duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M15 19l-7-7 7-7" strokeWidth={2} />
                  </svg>
                </button>

                <h2 className="text-xl font-bold text-gray-900">
                  {renderModeLabel(currentChartMode)}
                </h2>

                <button
                  onClick={nextMode}
                  className="p-2 hover:bg-gray-100 rounded transition-colors duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 5l7 7-7 7" strokeWidth={2} />
                  </svg>
                </button>
              </div>

              {/* Chart Container */}
              <div className="w-full h-[400px] sm:h-[500px] overflow-hidden">
                <Chart
                  width="100%"
                  height="100%"
                  chartType="LineChart"
                  loader={
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-gray-500"></div>
                    </div>
                  }
                  data={chartDataForGoogle}
                  options={chartOptions}
                />
              </div>
            </motion.div>

            {/* TABLE CARD */}
            <motion.div
              className="bg-white rounded shadow p-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-xl mb-3 font-semibold">Tic Data Table</h3>

              {/* EXPORT BUTTONS */}
              <div className="flex gap-4 mb-3">
                <button
                  onClick={exportToCSV}
                  className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded"
                >
                  Export as CSV
                </button>
                <button
                  onClick={exportToExcel}
                  className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded"
                >
                  Export as Excel
                </button>
              </div>

              {/* Mobile Sort Button */}
              <MobileSortButton
                onSortClick={toggleSort}
                sortDirection={sortDirection}
              />

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="tic-table min-w-full bg-white rounded-lg overflow-hidden border">
                  <thead className="bg-gray-300 text-black">
                    <tr>
                      <th className="py-3 px-6 text-left">
                        <div className="flex items-center gap-2">
                          Date
                          <button
                            onClick={toggleSort}
                            className="p-1 rounded hover:bg-gray-400 transition-colors duration-200"
                            title={`Sort by date (${
                              sortDirection === "desc" ? "newest first" : "oldest first"
                            })`}
                          >
                            <ArrowUpDown size={16} />
                          </button>
                        </div>
                      </th>
                      <th className="py-3 px-6 text-left">Time of Day</th>
                      <th className="py-3 px-6 text-left">Location (Tic)</th>
                      <th className="py-3 px-6 text-left">Intensity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4">
                          No data available.
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((tic, index) => (
                        <tr
                          key={index}
                          className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                        >
                          <td data-label="Date" className="py-3 px-6">
                            {new Date(tic.date).toLocaleDateString()}
                          </td>
                          <td data-label="Time of Day" className="py-3 px-6">
                            {tic.timeOfDay}
                          </td>
                          <td data-label="Location (Tic)" className="py-3 px-6">
                            {tic.location}
                          </td>
                          <td data-label="Intensity" className="py-3 px-6">
                            {tic.intensity}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default TicData;
