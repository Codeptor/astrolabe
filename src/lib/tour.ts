export interface TourStop {
  observer: string
  headline: string
  body: string
}

export const TOUR: TourStop[] = [
  {
    observer: "Sol",
    headline: "home · Sol",
    body: "The plaque was designed from here in 1972. This is the view Pioneer 10 and the Voyagers carry with them — the pulsar arrangement humanity used to encode 'here' in a language any spacefaring civilisation could decode.",
  },
  {
    observer: "Proxima Centauri",
    headline: "Proxima Centauri · 1.3 pc",
    body: "Our nearest star. At 1.3 parsecs the lines barely shift — pulsars are so far away that the ~4 ly hop is invisible. This is the map an observer at Earth's doorstep would see.",
  },
  {
    observer: "Sirius",
    headline: "Sirius · 2.6 pc",
    body: "The brightest star in Earth's sky. Its proper motion is the highest among naked-eye stars — 1.2 arcsec/yr — so the time-lapse will drift the map noticeably over 10 Myr.",
  },
  {
    observer: "Vega",
    headline: "Vega · 7.7 pc",
    body: "The photometric reference star — by convention V mag 0 is defined by Vega. From here, galactic longitudes rotate by ~67° compared to Sol's view.",
  },
  {
    observer: "Barnard's Star",
    headline: "Barnard's Star · 1.8 pc",
    body: "The second-closest stellar system, and the record-holder for proper motion at 10.3 arcsec/yr. Left unchecked it'd sweep across 2° of sky in 1000 years.",
  },
  {
    observer: "Procyon",
    headline: "Procyon · 3.5 pc",
    body: "An F5 subgiant, 3.5 parsecs away, in Canis Minor. From here Sirius sits roughly 'behind' us — the bright tip of a triangle we used to stand on.",
  },
  {
    observer: "Alpha Centauri A",
    headline: "α Centauri A · 1.3 pc",
    body: "The closest Sol-like star — a G2V sibling of the Sun. The plaque's triangulation set looks almost identical from here, which is the point: geometric stability across nearby observers is what makes it a useful address.",
  },
  {
    observer: "Betelgeuse",
    headline: "Betelgeuse · 150 pc",
    body: "A red supergiant in Orion's shoulder. At 150 parsecs (much further than any previous stop), the galactic-center reference line dominates — local pulsar distances start to feel small compared to the GC distance.",
  },
]
