import { useEffect } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { ProductDemo } from './components/ProductDemo'
import { HowItWorks } from './components/HowItWorks'
import { PricingCTA } from './components/PricingCTA'
import { Footer } from './components/Footer'
import './App.css'

function App() {
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

    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProductDemo />
        <HowItWorks />
        <PricingCTA />
      </main>
      <Footer />
    </>
  )
}

export default App
