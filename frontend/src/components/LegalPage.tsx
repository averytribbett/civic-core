import { Header } from './Header'
import { Footer } from './Footer'
import type { LegalDocument } from '../content/legal/types'
import './LegalPage.css'

type LegalPageProps = {
  document: LegalDocument
}

export function LegalPage({ document }: LegalPageProps) {
  return (
    <div className="page">
      <Header />
      <main className="legal-page">
        <header className="legal-page__header cell">
          <p className="mono-label mono-label--muted">Legal</p>
          <h1 className="legal-page__title">{document.title}</h1>
          <p className="legal-page__subtitle">{document.subtitle}</p>
        </header>
        <div className="legal-page__body cell">
          {document.sections.map((section) => (
            <section
              key={section.title ?? section.paragraphs[0]}
              id={section.id}
              className="legal-section"
            >
              {section.title ? (
                <h2 className="legal-section__title">{section.title}</h2>
              ) : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="legal-section__p">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="legal-section__list">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
