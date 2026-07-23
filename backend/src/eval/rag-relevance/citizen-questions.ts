import type { DocumentKind, RankableChunk } from "../../lib/document-kind"

export type CitizenEvalCase = {
  id: string
  /** Citizen-facing question used as the retrieval query. */
  query: string
  category: "taxes" | "permits" | "hours" | "contacts"
  /**
   * Simulated vector-search hits (already above similarity threshold).
   * Oversampled so similarity-only top-5 is agenda-heavy; soft re-rank
   * should admit citizen HTML pages into the top-k.
   */
  vectorHits: RankableChunk[]
}

function hit(
  id: string,
  similarity: number,
  doc: {
    id: string
    url: string
    title: string
    docKind: DocumentKind
  },
  chunkIndex = 0,
): RankableChunk {
  return {
    id,
    chunkIndex,
    similarity,
    document: {
      id: doc.id,
      url: doc.url,
      title: doc.title,
      docKind: doc.docKind,
    },
  }
}

/**
 * Fixed citizen-question eval set for measuring agenda/PDF vs HTML mix
 * after soft re-rank + diversity.
 */
export const CITIZEN_EVAL_CASES: CitizenEvalCase[] = [
  {
    id: "taxes-due-date",
    category: "taxes",
    query: "When are property taxes due?",
    vectorHits: [
      hit("t-a1", 0.86, {
        id: "tax-agenda-1",
        url: "https://example.gov/meetings/2024-03-board-agenda.pdf",
        title: "Board Agenda March 2024",
        docKind: "agenda",
      }),
      hit("t-a2", 0.855, {
        id: "tax-agenda-1",
        url: "https://example.gov/meetings/2024-03-board-agenda.pdf",
        title: "Board Agenda March 2024",
        docKind: "agenda",
      }, 1),
      hit("t-a3", 0.85, {
        id: "tax-agenda-2",
        url: "https://example.gov/meetings/2024-01-agenda.pdf",
        title: "Board Agenda January 2024",
        docKind: "agenda",
      }),
      hit("t-a4", 0.845, {
        id: "tax-agenda-2",
        url: "https://example.gov/meetings/2024-01-agenda.pdf",
        title: "Board Agenda January 2024",
        docKind: "agenda",
      }, 1),
      hit("t-m1", 0.84, {
        id: "tax-minutes",
        url: "https://example.gov/meetings/2024-02-minutes.pdf",
        title: "Board Minutes February 2024",
        docKind: "minutes",
      }),
      hit("t-h1", 0.8, {
        id: "tax-html",
        url: "https://example.gov/departments/treasury/property-taxes",
        title: "Property Taxes",
        docKind: "html_page",
      }),
      hit("t-p1", 0.78, {
        id: "tax-pdf",
        url: "https://example.gov/forms/tax-schedule.pdf",
        title: "Tax Payment Schedule",
        docKind: "pdf",
      }),
    ],
  },
  {
    id: "permits-building",
    category: "permits",
    query: "How do I apply for a building permit?",
    vectorHits: [
      hit("p-a1", 0.88, {
        id: "permit-agenda",
        url: "https://example.gov/planning/meeting-packet.pdf",
        title: "Planning Commission Packet",
        docKind: "agenda",
      }),
      hit("p-a2", 0.87, {
        id: "permit-agenda",
        url: "https://example.gov/planning/meeting-packet.pdf",
        title: "Planning Commission Packet",
        docKind: "agenda",
      }, 1),
      hit("p-a3", 0.86, {
        id: "permit-agenda-2",
        url: "https://example.gov/planning/2023-packet.pdf",
        title: "Meeting Packet 2023",
        docKind: "agenda",
      }),
      hit("p-a4", 0.85, {
        id: "permit-agenda-3",
        url: "https://example.gov/board/agenda-permits.pdf",
        title: "Board Agenda – Permits",
        docKind: "agenda",
      }),
      hit("p-m1", 0.84, {
        id: "permit-minutes",
        url: "https://example.gov/planning/minutes.pdf",
        title: "Planning Minutes",
        docKind: "minutes",
      }),
      hit("p-h1", 0.81, {
        id: "permit-html",
        url: "https://example.gov/departments/building/permits",
        title: "Building Permits",
        docKind: "html_page",
      }),
      hit("p-h2", 0.79, {
        id: "permit-html-2",
        url: "https://example.gov/departments/building/how-to-apply",
        title: "How to Apply",
        docKind: "html_page",
      }),
    ],
  },
  {
    id: "hours-clerk",
    category: "hours",
    query: "What are the county clerk office hours?",
    vectorHits: [
      hit("h-a1", 0.85, {
        id: "hours-agenda-1",
        url: "https://example.gov/board/2023-11-agenda.pdf",
        title: "Agenda – Office Hours Discussion",
        docKind: "agenda",
      }),
      hit("h-a2", 0.845, {
        id: "hours-agenda-1",
        url: "https://example.gov/board/2023-11-agenda.pdf",
        title: "Agenda – Office Hours Discussion",
        docKind: "agenda",
      }, 1),
      hit("h-a3", 0.84, {
        id: "hours-agenda-2",
        url: "https://example.gov/board/2023-10-agenda.pdf",
        title: "October Agenda",
        docKind: "agenda",
      }),
      hit("h-m1", 0.835, {
        id: "hours-minutes",
        url: "https://example.gov/board/2023-11-minutes.pdf",
        title: "Meeting Minutes",
        docKind: "minutes",
      }),
      hit("h-m2", 0.83, {
        id: "hours-minutes-2",
        url: "https://example.gov/board/2023-10-minutes.pdf",
        title: "October Minutes",
        docKind: "minutes",
      }),
      hit("h-h1", 0.8, {
        id: "hours-html",
        url: "https://example.gov/departments/clerk",
        title: "County Clerk",
        docKind: "html_page",
      }),
      hit("h-h2", 0.77, {
        id: "hours-html-2",
        url: "https://example.gov/contact/offices",
        title: "Office Locations & Hours",
        docKind: "html_page",
      }),
    ],
  },
  {
    id: "contacts-planning",
    category: "contacts",
    query: "Who do I call about zoning questions?",
    vectorHits: [
      hit("c-a1", 0.87, {
        id: "contact-agenda-1",
        url: "https://example.gov/meetings/zoning-board-agenda.pdf",
        title: "Zoning Board Agenda",
        docKind: "agenda",
      }),
      hit("c-a2", 0.86, {
        id: "contact-agenda-1",
        url: "https://example.gov/meetings/zoning-board-agenda.pdf",
        title: "Zoning Board Agenda",
        docKind: "agenda",
      }, 1),
      hit("c-a3", 0.85, {
        id: "contact-agenda-2",
        url: "https://example.gov/meetings/another-agenda.pdf",
        title: "Board Agenda",
        docKind: "agenda",
      }),
      hit("c-a4", 0.84, {
        id: "contact-agenda-3",
        url: "https://example.gov/meetings/packet-zoning.pdf",
        title: "Zoning Packet",
        docKind: "agenda",
      }),
      hit("c-m1", 0.83, {
        id: "contact-minutes",
        url: "https://example.gov/meetings/zoning-minutes.pdf",
        title: "Zoning Minutes",
        docKind: "minutes",
      }),
      hit("c-h1", 0.81, {
        id: "contact-html",
        url: "https://example.gov/departments/planning/contact",
        title: "Planning & Zoning Contact",
        docKind: "html_page",
      }),
      hit("c-p1", 0.76, {
        id: "contact-pdf",
        url: "https://example.gov/directory.pdf",
        title: "Staff Directory",
        docKind: "pdf",
      }),
    ],
  },
]
