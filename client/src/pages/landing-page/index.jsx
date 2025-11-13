"use client";
import { Navbar } from "@/components/Navbar";

import BackgroundImage from "../../../public/images/background.png";

export default function LandingPage() {
  return (
    <main className="min-h-screen font-sans px-4 md:px-40  bg-gradient-to-r from-[#E6F3eF]/80 to-[#E8FCEB]/80">

      <Navbar />

      <section
        className="relative flex flex-col md:flex-row items-center justify-between min-h-[85vh] bg-center bg-cover bg-no-repeat rounded-3xl overflow-hidden"
        style={{
          backgroundImage: `url(${BackgroundImage.src})`,
        }}
      >
        <div className="absolute inset-0"></div>

        <div className="relative max-w-lg text-center md:text-left z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Learn English by Talking to Real People
          </h2>
          <p className="text-lg text-gray-700 mb-8 leading-relaxed">
            Connect with random English learners around the world through voice calls.
            Practice real conversations, overcome hesitation, and build fluency the natural way —
            by speaking, not studying.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center md:justify-start">
            <button className="bg-blue-600 text-white px-8 py-4 rounded-full shadow-lg font-semibold hover:bg-blue-700 transition">
              Start Talking
            </button>
            <button className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-full font-semibold hover:bg-blue-600 hover:text-white transition">
              How It Works
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
