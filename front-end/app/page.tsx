import TopNav from "../components/TopNav"
import HeroSection from "../components/HeroSection"

export default function Page() {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <TopNav />
      <HeroSection />
    </div>
  )
}
