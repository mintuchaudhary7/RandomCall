"use client";

import { useRouter } from "next/router";

export const Navbar = () => {
  const router = useRouter();
  return (
    <header className="w-full sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center py-4 px-4 md:px-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#29624F] tracking-tight">
          Let's Talk
        </h1>

        <nav className="hidden md:flex gap-8 text-gray-700 font-medium">
          <a href="#how" className="hover:text-blue-600 transition-colors duration-200">
            How it Works
          </a>
          <a href="#features" className="hover:text-blue-600 transition-colors duration-200">
            Features
          </a>
          <a href="#testimonials" className="hover:text-blue-600 transition-colors duration-200">
            Testimonials
          </a>
        </nav>

        <div className="flex gap-3">
          <button className="border border-blue-600 text-blue-600 px-5 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md">
            Log In
          </button>
          <button
           onClick={() => router.push("/signin")}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Sign Up
          </button>
        </div>
      </div>
    </header>
  );
};
