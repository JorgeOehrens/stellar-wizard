import TopNav from "../../components/TopNav"
import Image from "next/image"
import { Button } from "../../components/ui/button"
import { Card, CardContent } from "../../components/ui/card"
import { Clock, Zap, TrendingUp, Shield, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function DeFiPage() {
  return (
    <div className="min-h-screen bg-overlay-light dark:bg-overlay">
      <TopNav />

      {/* Coming Soon Hero Section */}
      <div className="container mx-auto px-6 py-32 pt-28">
        <div className="max-w-4xl mx-auto text-center">

          {/* Logo Animation */}
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-ping">
              <Image
                src="/stellar.svg"
                alt="Stellar"
                width={80}
                height={80}
                className="mx-auto opacity-20"
              />
            </div>
            <Image
              src="/stellar.svg"
              alt="Stellar"
              width={80}
              height={80}
              className="mx-auto relative z-10"
            />
          </div>

          {/* Coming Soon Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-hk-yellow/90 border border-hk-yellow rounded-full text-sm font-semibold text-hk-black mb-8 backdrop-blur-sm">
            <Clock className="w-4 h-4" />
            Próximamente
          </div>

          {/* Main Heading */}
          <h1 className="hackmeridian-headline text-4xl lg:text-7xl text-hk-black dark:text-white mb-6 tracking-wider leading-tight">
            PRÓXIMA
            <br />
            <span className="text-hk-yellow">
              INTEGRACIÓN
            </span>
            <br />
            <span className="hackmeridian-tagline text-2xl lg:text-4xl normal-case tracking-normal text-hk-gray dark:text-gray-300">
              DeFi en Stellar
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg lg:text-xl text-hk-gray dark:text-gray-200 mb-12 max-w-3xl mx-auto leading-relaxed">
            Estamos trabajando en traerte estrategias DeFi automatizadas, protocolos de lending,
            y herramientas avanzadas de trading en la red Stellar.
          </p>

          {/* Features Coming Soon */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-white/80 dark:bg-white/10 backdrop-blur border border-black/20 dark:border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-hk-yellow/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <TrendingUp className="w-6 h-6 text-hk-yellow" />
                </div>
                <h3 className="text-lg font-semibold text-hk-black dark:text-white mb-2">
                  Yield Farming
                </h3>
                <p className="text-hk-gray dark:text-white/80 text-sm">
                  Estrategias automatizadas de farming con los mejores protocolos de Stellar
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-white/10 backdrop-blur border border-black/20 dark:border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-hk-yellow/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Shield className="w-6 h-6 text-hk-yellow" />
                </div>
                <h3 className="text-lg font-semibold text-hk-black dark:text-white mb-2">
                  Lending & Borrowing
                </h3>
                <p className="text-hk-gray dark:text-white/80 text-sm">
                  Protocolos de préstamos descentralizados con tasas competitivas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-white/10 backdrop-blur border border-black/20 dark:border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-hk-yellow/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Zap className="w-6 h-6 text-hk-yellow" />
                </div>
                <h3 className="text-lg font-semibold text-hk-black dark:text-white mb-2">
                  Auto-Trading
                </h3>
                <p className="text-hk-gray dark:text-white/80 text-sm">
                  Bots de trading inteligentes con IA para maximizar ganancias
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="space-y-4">
            <p className="text-hk-gray dark:text-gray-300 text-sm">
              Mientras tanto, puedes crear NFTs increíbles
            </p>
            <Link href="/nfts">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white px-8 py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300">
                <Image
                  src="/stellar.svg"
                  alt="Stellar"
                  width={20}
                  height={20}
                  className="mr-2"
                />
                Crear NFTs Ahora
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}

