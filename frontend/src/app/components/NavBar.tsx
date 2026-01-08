"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();
  
  const navLinks = [
    { href: "/", label: "HOME" },
    { href: "/leaderboard", label: "LEADERBOARD" },
    { href: "/creators", label: "CREATORS" },
    { href: "/about", label: "ABOUT" },
  ];

  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-[#1a1a1a]"
      style={{ fontFamily: "var(--font-playfair-serif), serif" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo/Brand - Left */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl md:text-2xl font-bold text-white hover:opacity-80 transition-opacity">
              FinTruth
            </Link>
          </div>

          {/* Navigation Links - Center */}
          <div className="hidden md:flex items-center space-x-8 lg:space-x-12">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm lg:text-base font-medium transition-colors uppercase tracking-wide ${
                    isActive 
                      ? "text-white border-b-2 border-white pb-1" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Buttons - Right */}
          <div className="flex items-center space-x-3 md:space-x-4">
            <button className="hidden sm:inline-block px-4 py-2 text-xs md:text-sm font-medium text-white border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#141414] transition-colors uppercase tracking-wide">
              Submit Creator
            </button>
            <button className="px-4 py-2 text-xs md:text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors uppercase tracking-wide">
              About
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
