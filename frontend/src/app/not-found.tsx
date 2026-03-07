import Link from "next/link";
import { FiSearch } from "react-icons/fi";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <FiSearch className="w-20 h-20 mx-auto mb-6 text-gray-300" aria-hidden="true" />
      <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
        找不到這個頁面
      </h1>
      <p className="text-gray-500 text-lg mb-8">
        您尋找的文章可能已移除，或連結有誤。
      </p>
      <Link
        href="/"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        回到首頁
      </Link>
    </div>
  );
}
