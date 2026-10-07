import { useEffect } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Features } from './components/Features'
import { PricingCTA } from './components/PricingCTA'
import { Footer } from './components/Footer'
import { VoicePage } from './components/VoicePage'
import { scrollToSection } from './lib/scrollToSection'
import './App.css'

function MarketingHome() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observer.observe(el)
    })

    const hash = window.location.hash.replace('#', '')
    if (hash) {
      requestAnimationFrame(() => scrollToSection(hash))
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="page">
      <Header />
      <main className="page__main">
        <Hero />
        <HowItWorks />
        <Features />
        <PricingCTA />
      </main>
      <Footer />
    </div>
  )
}

function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'

  if (path === '/voice') {
    return <VoicePage />
  }

  return <MarketingHome />
}

export default App
