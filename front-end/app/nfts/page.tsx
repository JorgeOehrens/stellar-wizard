import TopNav from "../../components/TopNav"
import NFTCreator from "../../components/NFTCreator"

export default function NFTsPage() {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <TopNav />
      <div className="pt-28">
        <NFTCreator />
      </div>
    </div>
  );
}