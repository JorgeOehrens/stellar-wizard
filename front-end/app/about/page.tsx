import TopNav from "../../components/TopNav"
import AboutSection from "../../components/AboutSection"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <TopNav />
      <div className="pt-20">
        <AboutSection />
      </div>
    </div>
  );
}