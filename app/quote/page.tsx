"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Loading from "../components/Loading";
import ErrorModal from "../components/ErrorModal";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const customScrollbarStyle = `
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d0d0d0;
}
`;

type Quote = {
  _id: string;
  qoute: string;
  vote: number;
};

export default function Page() {
  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = customScrollbarStyle;
    document.head.appendChild(styleTag);

    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [voteLoadingId, setVoteLoadingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showChart, setShowChart] = useState(false);
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    message: "",
  });

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);

    try {
      const url = new URL("http://localhost:8000/qoute");

      if (search.trim() !== "") {
        url.searchParams.append("search", search.trim());
      }

      const res = await fetch(url.toString(), { credentials: "include" });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)");
        }

        const errorData = await res
          .json()
          .catch(() => ({ message: `HTTP error! status: ${res.status}` }));
        throw new Error(
          errorData.message || `HTTP error! status: ${res.status}`
        );
      }

      const data = await res.json();

      const quotesArray = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      setQuotes(quotesArray);
    } catch (e: any) {
      const errorMessage = e.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล";
      setErrorModal({
        isOpen: true,
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [search]);

  // debounce fetchQuotes หลังหยุดพิมพ์ 500ms
  useEffect(() => {
   
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
 
    debounceTimeout.current = setTimeout(() => {
      setLoading(true)
      fetchQuotes();
    }, 500);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [search, fetchQuotes]);

  // handle vote
  const handleVote = async (id: string) => {
    setVoteLoadingId(id);
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:8000/qoute/vote/${id}`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("กรุณาเข้าสู่ระบบก่อนโหวต (Unauthorized)");
        }

        const errorData = await res
          .json()
          .catch(() => ({ message: "Vote failed" }));
        throw new Error(errorData.message || "Vote failed");
      }

      const result = await res.json();

      setQuotes((prev) =>
        prev.map((q) => (q._id === id ? { ...q, vote: result.data.vote } : q))
      );
    } catch (e: any) {
      let errorMessage = e.message || "Vote failed";

      if (
        errorMessage.includes("User has already voted") ||
        errorMessage.includes("Cannot vote anymore")
      ) {
        errorMessage = "ไม่สามารถโหวตคำคมนี้ได้แล้ว";
      }

      setErrorModal({
        isOpen: true,
        message: errorMessage,
      });
    } finally {
      setVoteLoadingId(null);
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const closeErrorModal = () => {
    if (errorModal.message.includes("Unauthorized")) {
      window.location.href = "/";
    } else {
      setErrorModal({
        isOpen: false,
        message: "",
      });
    }
  };

  const filteredQuotes = quotes
    .filter((q) => q.qoute.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.vote - b.vote;
      } else {
        return b.vote - a.vote;
      }
    });

  const chartData = {
    labels: filteredQuotes
      .slice(0, 5)
      .map((q) =>
        q.qoute.length > 20 ? q.qoute.substring(0, 20) + "..." : q.qoute
      ),
    datasets: [
      {
        label: "จำนวนโหวต",
        data: filteredQuotes.slice(0, 5).map((q) => q.vote),
        backgroundColor: "rgba(219, 39, 119, 0.7)",
        borderColor: "rgba(219, 39, 119, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          boxWidth: 15,
          font: {
            size: 11,
          },
        },
      },
      title: {
        display: true,
        text: "คำคมยอดนิยม 5 อันดับแรก",
        font: {
          size: 14,
        },
      },
    },
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 sm:p-8 w-full">
      <Loading isLoading={loading} />
      <ErrorModal
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        onClose={closeErrorModal}
      />
      <div className="w-full max-w-3xl p-6 sm:p-8 shadow-xl rounded-xl bg-white flex flex-col border border-pink-100">
        <h1 className="text-3xl font-bold text-center mb-8 text-pink-600">
          ✨ โหวตคำคมกวนๆ ✨
        </h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาคำคม..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-10 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-300 outline-none transition-all"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-all"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={
                    sortOrder === "asc"
                      ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                      : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                  }
                />
              </svg>
              {sortOrder === "asc" ? "น้อยไปมาก" : "มากไปน้อย"}
            </button>

            <button
              onClick={() => setShowChart(!showChart)}
              className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-all"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {showChart ? "ซ่อนกราฟ" : "แสดงกราฟ"}
            </button>
          </div>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {showChart && filteredQuotes.length > 0 && (
            <div className="mb-6 p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
              <div className="flex justify-center items-center h-[160px] overflow-hidden">
                <div className="w-[95%]">
                  <Bar options={chartOptions} data={chartData} height={140} />
                </div>
              </div>
            </div>
          )}
          {filteredQuotes.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>ไม่พบคำคมที่ค้นหา</p>
            </div>
          )}

          {filteredQuotes.map((q, i) => (
            <div
              key={q._id}
              className="border border-gray-100 p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white flex justify-between items-center gap-4"
            >
              <div className="flex-1">
                <p className="text-lg font-medium">
                  <span className="text-pink-500 font-bold mr-2">{i + 1}.</span>{" "}
                  {q.qoute}
                </p>
                <p className="mt-2 text-gray-600 flex items-center">
                  <svg
                    className="w-5 h-5 text-red-500 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  <span>{q.vote} Vote</span>
                </p>
              </div>
              <button
                onClick={() => handleVote(q._id)}
                disabled={voteLoadingId === q._id}
                className={`px-4 py-2 rounded-lg text-white font-medium flex items-center ${
                  voteLoadingId === q._id
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-sm hover:shadow"
                } transition-all`}
              >
                {voteLoadingId === q._id ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    กำลังโหวต
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                    Vote
                  </span>
                )}
              </button>
            </div>
          ))}

          {filteredQuotes.length > 0 && (
            <div className="text-center py-4 text-gray-500 border-t border-gray-100 mt-4 pt-4">
              <svg
                className="mx-auto h-6 w-6 text-pink-400 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p>แสดงทั้งหมด {filteredQuotes.length} รายการ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}