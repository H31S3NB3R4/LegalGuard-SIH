"use client"
import { useState, Suspense } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LayoutDashboard, FileCheck, ShieldCheck, MessageSquare, ShoppingBag, Building2, LogOut , GiftIcon } from "lucide-react"
import { Poppins } from "next/font/google"

const poppins = Poppins({ weight: ["400", "500", "600", "700"], subsets: ["latin"] })
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

export default function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  );
}

function NavbarContent() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const userId = searchParams.get("userId")
  const userRole = searchParams.get("role")

  // ============================
  // ROLE-BASED NAVIGATION
  // ============================

  // Consumer sees:
  // Dashboard, Check Compliance, Entities, Products, Chatbot
  const consumerNav = [
    { name: "DASHBOARD", path: "dashboard", icon: LayoutDashboard },
    { name: "CHECK COMPLIANCE", path: "check-compliance", icon: FileCheck },
    { name: "ENTITIES", path: "entities", icon: Building2 },
    { name: "PRODUCTS", path: "products", icon: ShoppingBag },
    { name: "CHATBOT", path: "chatbot", icon: MessageSquare },
    { name: "REWARDS", path: "rewards", icon: GiftIcon },
  ]

  // Seller sees ONLY:
  // Seller Verification, Chatbot
  const sellerNav = [
    { name: "SELLER VERIFICATION", path: "seller-verification", icon: ShieldCheck },
    { name: "CHATBOT", path: "chatbot", icon: MessageSquare },
  ]

  const navItems = userRole === "seller" ? sellerNav : consumerNav

  const navigateWithParams = (path) => {
    if (userId && userRole) {
      router.push(`/${path}?userId=${userId}&role=${userRole}`)
    } else {
      router.push(`/${path}`)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className={`fixed left-0 top-0 h-screen bg-black/80 backdrop-blur-xl border-r border-purple-500/30 transition-all duration-300 z-50 ${isCollapsed ? "w-20" : "w-64"}`}>


      {/* LOGO */}
      <div className="px-6 py-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              LegalGuard
            </h2>
          )}
          {/* Collapse Button — visible ONLY on small screens */}
<button 
  onClick={() => setIsCollapsed(!isCollapsed)} 
  className="p-1 rounded-lg hover:bg-white/10 lg:hidden"
>
  <svg 
    className={`w-5 h-5 transition-transform ${isCollapsed ? "rotate-0" : "rotate-180"}`} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
</button>

        </div>
      </div>


      {/* NAVIGATION */}
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === `/${item.path}`
          return (
            <button
              key={item.path}
              onClick={() => navigateWithParams(item.path)}
              className={`w-full flex items-center gap-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 border-cyan-400/50 border hover:bg-white/10"
                  : "hover:bg-white/10"
              } ${isCollapsed ? "justify-center px-3 py-4" : "px-4 py-3"}`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "text-cyan-400" : "text-gray-400"}`} />
              {!isCollapsed && (
                <span className={`${poppins.className} font-medium uppercase tracking-wider text-xs ${isActive ? "text-white" : "text-gray-400"}`}>
                  {item.name}
                </span>
              )}
            </button>
          )
        })}
      </nav>


      {/* LOGOUT */}
      {userId && userRole && (
        <div className="px-4 py-2 border-t border-purple-500/30">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-red-500/20 hover:border-red-400/50 border border-transparent group ${isCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-6 h-6 text-red-400 group-hover:text-red-300" />
            {!isCollapsed && (
              <span className="text-red-400 group-hover:text-red-300 uppercase tracking-wider text-xs">
                LOGOUT
              </span>
            )}
          </button>
        </div>
      )}


      {/* FOOTER */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-purple-500/30">
          {userRole && (
            <div className="mb-3 px-3 py-2 bg-purple-600/20 rounded-lg border border-purple-500/30">
              <p className="text-xs text-purple-300 uppercase tracking-wider">
                Role: <span className="font-bold text-cyan-400">{userRole}</span>
              </p>
            </div>
          )}
          <p className="text-xs text-gray-500 uppercase tracking-wider">© 2025 LEGALGUARD</p>
        </div>
      )}
    </div>
  )
}
