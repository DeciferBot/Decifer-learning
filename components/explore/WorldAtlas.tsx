'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from '@/components/explore/NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import type { DroppedCard } from '@/app/api/quiz/submit/route'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Continent = 'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania'
export type WonderType = 'population' | 'size' | 'climate' | 'trade' | 'language' | 'extremes'

export interface Country {
  key: string
  name: string
  continent: Continent
  lat: number
  lng: number
  capital: string
  population: string
  area: string
  flag: string
  color: string
  narration: string
  layers: [
    { id: 1; label: string; icon: string; content: string; narration: string },
    { id: 2; label: string; icon: string; content: string; narration: string },
    { id: 3; label: string; icon: string; content: string; narration: string },
  ]
  wonderType: WonderType
  whatIf: string
}

// ─── Helper: lat/lng → 3D position on sphere ─────────────────────────────────

function latLngTo3D(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

// ─── Continent metadata ───────────────────────────────────────────────────────

export const CONTINENTS: Record<Continent, { name: string; emoji: string; color: string; lat: number; lng: number }> = {
  europe:          { name: 'Europe',      emoji: '🏰', color: '#6C9EFF', lat: 54,  lng: 15   },
  asia:            { name: 'Asia',         emoji: '🏯', color: '#A78BFA', lat: 34,  lng: 100  },
  africa:          { name: 'Africa',       emoji: '🌍', color: '#FBBF24', lat: 5,   lng: 22   },
  'north-america': { name: 'N. America',   emoji: '🗽', color: '#F87171', lat: 45,  lng: -100 },
  'south-america': { name: 'S. America',   emoji: '🌿', color: '#34D399', lat: -15, lng: -60  },
  oceania:         { name: 'Oceania',      emoji: '🦘', color: '#FB923C', lat: -27, lng: 133  },
}

// ─── Country Data ─────────────────────────────────────────────────────────────

export const COUNTRIES: Country[] = [
  // ── EUROPE ──────────────────────────────────────────────────────────────────
  {
    key: 'uk', name: 'United Kingdom', continent: 'europe', lat: 51.5, lng: -0.1,
    capital: 'London', population: '67 million', area: '242,900 km²', flag: '🇬🇧', color: '#6C9EFF',
    narration: 'The United Kingdom — a small island nation whose language is now spoken by over a billion people, and whose empire once covered a quarter of the Earth\'s surface.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The UK is four countries in one: England, Scotland, Wales, and Northern Ireland. The British Empire was once so vast that the sun never set on it — there was always daylight somewhere in its territories.', narration: 'The UK is four countries in one, and at its peak, the sun never set on its empire.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Industrial Revolution began here in the 1760s. The steam engine, the railway, the spinning jenny — all British inventions that transformed how the world makes things and moves people.', narration: 'The Industrial Revolution was born in Britain, and it changed manufacturing forever.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Why did industrialisation start in Britain specifically? Historians point to three factors: abundant coal deposits near cities, strong property rights protecting inventors, and the Royal Society creating a culture of scientific sharing.', narration: 'Why Britain? Coal, property rights, and a scientific culture all came together at the right moment.' },
    ],
    wonderType: 'size', whatIf: 'What if the British Empire still existed today?',
  },
  {
    key: 'france', name: 'France', continent: 'europe', lat: 48.9, lng: 2.3,
    capital: 'Paris', population: '68 million', area: '643,800 km²', flag: '🇫🇷', color: '#60A5FA',
    narration: 'France — home to the Eiffel Tower, the Louvre, and revolutionary ideas about liberty that reshaped the modern world.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The Eiffel Tower was originally built as a temporary structure and was meant to be demolished after 20 years. It was saved because it doubled as a radio transmitter — and helped intercept German communications in World War One.', narration: 'The Eiffel Tower was almost demolished. Only radio saved it.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The French Revolution of 1789 gave the world liberté, égalité, fraternité — ideas that inspired democratic movements from America to Haiti to Vietnam. France changed how countries think about rights.', narration: 'France\'s revolution gave the world its most powerful political ideas.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Despite being smaller than Texas, France has the world\'s largest exclusive economic zone — the ocean it controls — because of its territories scattered across the Pacific, Caribbean, and Indian Ocean.', narration: 'France secretly controls more ocean than any other country on Earth.' },
    ],
    wonderType: 'trade', whatIf: 'What if the French Revolution had failed?',
  },
  {
    key: 'germany', name: 'Germany', continent: 'europe', lat: 52.5, lng: 13.4,
    capital: 'Berlin', population: '84 million', area: '357,600 km²', flag: '🇩🇪', color: '#93C5FD',
    narration: 'Germany — the economic powerhouse of Europe, rebuilt from rubble after World War Two to become one of the world\'s great engineering nations.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Germany has over 1,500 different types of beer and more than 300 varieties of bread. There is even a German word — Fingerspitzengefühl — meaning "fingertip feeling": the intuition to handle delicate situations with perfect tact.', narration: 'Germany has 300 types of bread, and a word for feelings English cannot express.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'After the Berlin Wall fell in 1989, Germany spent 1.6 trillion euros over 30 years reunifying East and West. Citizens paid a special "solidarity tax" to fund it — one of history\'s greatest peacetime rebuilding efforts.', narration: 'Reunification after the Berlin Wall cost 1.6 trillion euros over 30 years.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Germany\'s economic strength comes largely from Mittelstand companies — thousands of family-run mid-sized businesses that each dominate a tiny global niche. Many are the world\'s only supplier of very specific components.', narration: 'Germany\'s secret is thousands of family businesses that dominate very specific global niches.' },
    ],
    wonderType: 'trade', whatIf: 'What if the Berlin Wall had never fallen?',
  },
  {
    key: 'italy', name: 'Italy', continent: 'europe', lat: 41.9, lng: 12.5,
    capital: 'Rome', population: '60 million', area: '301,300 km²', flag: '🇮🇹', color: '#86EFAC',
    narration: 'Italy — the birthplace of the Roman Empire, the Renaissance, and modern cuisine, a boot-shaped peninsula that shaped Western civilisation.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Italy contains two independent countries inside it: Vatican City (the world\'s smallest country, 0.44 km²) and San Marino (the world\'s oldest republic, founded in 301 AD). Italy is the only country to contain two countries.', narration: 'Italy contains two other countries completely inside its borders.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Roman Empire lasted over 500 years and left roads, laws, and the Latin alphabet still used today. Italian descendants of Latin — through French, Spanish, Portuguese, and Romanian — are spoken by over 800 million people.', narration: 'The Roman Empire\'s roads, laws, and language still shape a billion lives today.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Italy has more UNESCO World Heritage Sites than any other country — 58 in total. Yet Italy also has the highest rate of heritage sites at risk, because caring for so much history is enormously expensive.', narration: 'Italy has more UNESCO sites than any country — and struggles to afford them all.' },
    ],
    wonderType: 'extremes', whatIf: 'What if the Roman Empire never fell?',
  },
  {
    key: 'russia', name: 'Russia', continent: 'europe', lat: 55.8, lng: 37.6,
    capital: 'Moscow', population: '145 million', area: '17,100,000 km²', flag: '🇷🇺', color: '#FCA5A5',
    narration: 'Russia — the largest country on Earth, spanning 11 time zones from the Baltic Sea to the Pacific Ocean, a land of extraordinary contradictions.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Russia is so enormous that when it\'s midnight in Kaliningrad on the Baltic coast, it\'s already 10 AM the next day in Kamchatka. It contains Lake Baikal — the world\'s deepest lake holding 20% of all fresh surface water on Earth.', narration: 'Russia spans 11 time zones and holds 20% of the world\'s fresh surface water.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Soviet Union launched the first satellite (Sputnik, 1957) and first human in space (Yuri Gagarin, 1961). The Space Race that followed led directly to the Moon landings and modern GPS technology.', narration: 'The Soviet Union started the Space Race, launching the first satellite and cosmonaut.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Russia has the world\'s largest reserves of natural gas and is a top oil producer. This "resource curse" creates economic dependence: when oil prices fall, Russia\'s economy contracts, limiting pressure to diversify.', narration: 'Russia\'s oil wealth is also its greatest vulnerability — the resource curse in action.' },
    ],
    wonderType: 'size', whatIf: 'What if Siberia were as populated as Western Europe?',
  },
  {
    key: 'spain', name: 'Spain', continent: 'europe', lat: 40.4, lng: -3.7,
    capital: 'Madrid', population: '47 million', area: '505,900 km²', flag: '🇪🇸', color: '#FDE68A',
    narration: 'Spain — a land of flamenco, football, and a language spoken by 600 million people across 21 countries, from Patagonia to Mexico City.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Spanish is the second most spoken language by native speakers on Earth, and most of its speakers live in the Americas, not Spain. The Spanish colonisation of the Americas (1492 onwards) spread the language to an entire hemisphere.', narration: 'Most Spanish speakers live in the Americas — not Spain.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Spain\'s Golden Age (1500s–1600s) saw Spanish explorers map most of the Americas, the Philippines, and parts of Africa. The wealth that flowed back — silver from Peru and Mexico — made Spain Europe\'s richest power for a century.', narration: 'Spain\'s Golden Age gave it the Americas and made it Europe\'s richest nation.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Spain has 17 autonomous regions, each with its own parliament and strong regional identity. Catalonia and the Basque Country have their own languages entirely. Managing this diversity is one of Spain\'s greatest ongoing political challenges.', narration: 'Spain\'s 17 regions each have their own parliaments — it\'s a country of countries.' },
    ],
    wonderType: 'language', whatIf: 'What if Columbus had never reached the Americas?',
  },
  {
    key: 'turkey', name: 'Turkey', continent: 'europe', lat: 39.9, lng: 32.9,
    capital: 'Ankara', population: '85 million', area: '783,600 km²', flag: '🇹🇷', color: '#FCD34D',
    narration: 'Turkey — a nation bridging two continents, where Europe meets Asia, and where civilisations have traded and clashed for 10,000 years.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Istanbul (formerly Constantinople) is the only city in the world that straddles two continents. The Bosphorus strait separating Europe from Asia runs through the middle of the city — you can sail from Europe to Asia in minutes.', narration: 'Istanbul is the only city straddling two continents — you can sail between them in minutes.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Göbekli Tepe in southern Turkey is the world\'s oldest known temple complex, built around 10,000 BCE — 6,000 years before Stonehenge and 7,000 years before the pyramids. It rewrote the history of human civilisation.', narration: 'Turkey\'s Göbekli Tepe is 6,000 years older than Stonehenge and rewrote human history.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'The Ottoman Empire ruled from 1299 to 1922 — 623 years — and at its peak controlled three continents. Its collapse after World War One created over a dozen modern countries, from Greece to Iraq to Saudi Arabia.', narration: 'The Ottoman Empire\'s 623-year collapse created the modern map of the Middle East.' },
    ],
    wonderType: 'extremes', whatIf: 'What if the Ottoman Empire had survived World War One?',
  },
  {
    key: 'netherlands', name: 'Netherlands', continent: 'europe', lat: 52.1, lng: 5.3,
    capital: 'Amsterdam', population: '17.9 million', area: '41,500 km²', flag: '🇳🇱', color: '#FCA5A5',
    narration: 'The Netherlands — a tiny nation that reclaimed land from the sea, built the world\'s first stock exchange, and created some of history\'s greatest art.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'About 26% of the Netherlands lies below sea level — and without its network of 3,000 polders (pumped dry areas) and 17,000 km of dykes, it would be underwater. The Dutch have been fighting the sea for 800 years.', narration: 'A quarter of the Netherlands is below sea level — kept dry by 800 years of engineering.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'In the 17th century the Dutch invented the stock exchange, joint-stock companies, and modern banking. The Amsterdam Stock Exchange, founded in 1602, was the world\'s first — and Dutch trade ships reached every corner of the globe.', narration: 'The Dutch invented the stock exchange and modern banking in the 1600s.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Despite being one of the world\'s most densely populated countries, the Netherlands is the second-largest food exporter on Earth after the USA — feeding much of Europe from its high-tech greenhouses and precision farming.', narration: 'Despite its tiny size, the Netherlands is the world\'s second largest food exporter.' },
    ],
    wonderType: 'size', whatIf: 'What if the Dutch hadn\'t invented the stock market?',
  },
  {
    key: 'poland', name: 'Poland', continent: 'europe', lat: 52.2, lng: 21.0,
    capital: 'Warsaw', population: '38 million', area: '312,700 km²', flag: '🇵🇱', color: '#FECACA',
    narration: 'Poland — a resilient nation that has been partitioned and occupied repeatedly, yet its language, culture, and identity survived centuries of adversity.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Poland disappeared from the map entirely for 123 years (1795–1918), divided between Russia, Prussia, and Austria. Yet during this time, Poles kept their language, culture, and national identity alive — and returned as a unified country after World War One.', narration: 'Poland vanished from the map for 123 years — and came back intact.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Nicolaus Copernicus, born in Poland in 1473, proved that the Earth orbits the Sun — not the other way around. His discovery was so radical that the Church condemned it, but it launched the Scientific Revolution.', narration: 'A Pole proved the Earth goes round the Sun, launching the Scientific Revolution.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Poland\'s economy grew every single year from 1990 to 2020 — the only EU country not to enter recession during the 2008 financial crisis. Its transformation from communist state to market economy is one of history\'s great economic success stories.', narration: 'Poland grew every year for 30 years straight — the only country to dodge the 2008 crash.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Poland had not survived partition?',
  },
  {
    key: 'sweden', name: 'Sweden', continent: 'europe', lat: 59.3, lng: 18.1,
    capital: 'Stockholm', population: '10.5 million', area: '450,300 km²', flag: '🇸🇪', color: '#BAE6FD',
    narration: 'Sweden — a Scandinavian nation of forests, fjords, and innovations from IKEA to Spotify, and a model of social welfare that the world studies.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Swedish inventor Alfred Nobel invented dynamite in 1867. Horrified that his obituary described him as "the merchant of death," he left his fortune to create the Nobel Prizes — awarded annually for those who benefit humanity most.', narration: 'Dynamite\'s inventor was so horrified by his legacy he created the Nobel Prizes.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Sweden has a concept called "lagom" — roughly meaning "just the right amount" — that shapes everything from portion sizes to workplace culture. It\'s why Swedish design is so famously simple and functional.', narration: 'The Swedish concept of lagom — just the right amount — shapes their design and culture.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Sweden was one of Europe\'s most warlike nations until 1814, having fought over 30 wars in 300 years. Since then it has had over 200 years of peace — the longest unbroken period of peace of any European country.', narration: 'Sweden was once Europe\'s most warlike nation. It has been at peace for 200 years.' },
    ],
    wonderType: 'population', whatIf: 'What if Nobel Prizes were awarded for something else?',
  },

  // ── ASIA ─────────────────────────────────────────────────────────────────────
  {
    key: 'china', name: 'China', continent: 'asia', lat: 39.9, lng: 116.4,
    capital: 'Beijing', population: '1.4 billion', area: '9,600,000 km²', flag: '🇨🇳', color: '#FCA5A5',
    narration: 'China — the world\'s most populous country, with a civilisation stretching back 4,000 years, and now the world\'s largest economy by purchasing power.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'China invented paper, printing, gunpowder, and the compass — four inventions that transformed human civilisation. Without them, there would be no books, no guns, no navigation, and no modern world as we know it.', narration: 'China invented paper, printing, gunpowder, and the compass. Four inventions that made modernity.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Great Wall of China, built over 2,000 years by multiple dynasties, stretches over 21,000 km. It took millions of workers, many of whom died during construction and were buried within the wall itself.', narration: 'The Great Wall took 2,000 years to build and millions of lives — some buried within it.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'China lifted 800 million people out of poverty between 1978 and 2018 — the greatest poverty reduction in human history. This happened through a unique model: market economics directed by a single-party state.', narration: 'China lifted 800 million people from poverty — the greatest such achievement in history.' },
    ],
    wonderType: 'population', whatIf: 'What if China had colonised the Americas instead of Europe?',
  },
  {
    key: 'japan', name: 'Japan', continent: 'asia', lat: 35.7, lng: 139.7,
    capital: 'Tokyo', population: '125 million', area: '377,900 km²', flag: '🇯🇵', color: '#FECACA',
    narration: 'Japan — an island nation of extraordinary contrasts, where ancient samurai culture meets bullet trains and robot restaurants.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Japan has 3 UNESCO World Heritage sites, 14 of the world\'s 50 best restaurants, and some cities that are older than most countries. Tokyo has more Michelin stars than any other city on Earth — more than Paris and New York combined.', narration: 'Tokyo has more Michelin stars than Paris and New York combined.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Japan was completely closed to the outside world from 1635 to 1853 — foreign trade and travel were illegal on pain of death. When Western ships finally forced it open, Japan transformed itself from feudal to industrialised in just 40 years.', narration: 'Japan was sealed from the world for 218 years — then industrialised faster than any nation.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Japan has a concept called "ikigai" — your reason for getting up in the morning, the intersection of what you love, what you\'re good at, what the world needs, and what you can be paid for. The Okinawan islanders who live longest credit it for their exceptional longevity.', narration: 'Japan\'s concept of ikigai — your reason for being — may explain why Okinawans live longest.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Japan had stayed closed to the world?',
  },
  {
    key: 'india', name: 'India', continent: 'asia', lat: 28.6, lng: 77.2,
    capital: 'New Delhi', population: '1.44 billion', area: '3,287,300 km²', flag: '🇮🇳', color: '#FDE68A',
    narration: 'India — the world\'s most populous democracy, birthplace of four major religions, and home to the largest film industry on the planet.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'India invented the concept of zero — without which computers, GPS, and modern mathematics would be impossible. The number system the entire world uses today (1, 2, 3…) was also invented in India and brought to Europe by Arab traders.', narration: 'India invented zero. Without it, computers and modern mathematics would be impossible.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'India\'s "zero-budget natural farming" movement, the world\'s largest independent satellite programme, and its generic pharmaceutical industry — providing 40% of US medicines — show a country innovating on its own terms rather than copying the West.', narration: 'India provides 40% of American medicines and runs its own independent space programme.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'India\'s caste system, despite being constitutionally abolished in 1950, still shapes social mobility, marriage patterns, and political voting 70 years later. Understanding why deeply embedded social structures persist is one of the great challenges of development.', narration: 'India abolished the caste system in 1950. Understanding why it persists is one of social science\'s biggest puzzles.' },
    ],
    wonderType: 'population', whatIf: 'What if India had never been colonised by Britain?',
  },
  {
    key: 'saudi-arabia', name: 'Saudi Arabia', continent: 'asia', lat: 24.7, lng: 46.7,
    capital: 'Riyadh', population: '36 million', area: '2,149,700 km²', flag: '🇸🇦', color: '#86EFAC',
    narration: 'Saudi Arabia — keeper of Islam\'s holiest cities, world\'s largest oil exporter, and a kingdom racing to reinvent itself before oil runs out.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Mecca in Saudi Arabia is the most visited city in the world during the Hajj pilgrimage — 2.5 million people arrive simultaneously in one week. Non-Muslims are not permitted to enter the city. It is the only major city on Earth with a restricted entry policy.', narration: 'Mecca receives 2.5 million visitors in one week — and non-Muslims cannot enter at all.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Saudi Arabia was a poor, nomadic desert kingdom until oil was discovered in 1938. Within two generations it built a modern state with skyscrapers, universities, and one of the world\'s largest sovereign wealth funds.', narration: 'Oil discovery in 1938 transformed a nomadic desert kingdom into a modern state in two generations.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Saudi Arabia\'s Vision 2030 plan aims to diversify its economy away from oil — building NEOM (a 170km long futuristic city), tourism, and technology. Whether it succeeds before oil demand falls will determine the country\'s long-term future.', narration: 'Saudi Arabia is racing to build a post-oil economy before the world stops needing oil.' },
    ],
    wonderType: 'trade', whatIf: 'What if oil had never been discovered in the Middle East?',
  },
  {
    key: 'south-korea', name: 'South Korea', continent: 'asia', lat: 37.6, lng: 127.0,
    capital: 'Seoul', population: '52 million', area: '100,400 km²', flag: '🇰🇷', color: '#C4B5FD',
    narration: 'South Korea — a country that went from one of the poorest on Earth to one of the richest in a single generation, and exported K-pop to the entire world.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'In 1960, South Korea was poorer than Ghana. Today it is the world\'s 10th largest economy, home to Samsung, Hyundai, and LG. This transformation — called the "Miracle on the Han River" — happened in about 30 years.', narration: 'South Korea was poorer than Ghana in 1960. Today it\'s a top-10 world economy.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'South Korea has the world\'s fastest average internet speeds and highest smartphone adoption. Seoul\'s public transport system is rated the best on Earth. Koreans are also among the world\'s most educated populations.', narration: 'South Korea has the world\'s fastest internet and best public transport.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Hallyu — the Korean Wave — has made K-pop, Korean drama, and Korean food globally popular. BTS generates more than £4 billion a year for the South Korean economy. Soft power as an economic strategy is rarely done this successfully.', narration: 'BTS generates £4 billion a year for South Korea. Soft power as economic strategy.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Korea had never been divided?',
  },
  {
    key: 'indonesia', name: 'Indonesia', continent: 'asia', lat: -6.2, lng: 106.8,
    capital: 'Jakarta', population: '277 million', area: '1,904,600 km²', flag: '🇮🇩', color: '#FCA5A5',
    narration: 'Indonesia — the world\'s largest archipelago nation, spanning 17,000 islands across an ocean wider than the continental USA.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Indonesia has 17,508 islands, 6,000 of which are inhabited. If you visited one new island every day, it would take you 48 years to see them all. It is also home to the world\'s second-largest rainforest and Komodo dragons.', narration: 'Indonesia has 17,508 islands. Visiting one per day would take 48 years.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Indonesia sits on the Pacific Ring of Fire and has more active volcanoes than any other country — 127 of them. The 1883 eruption of Krakatoa was so loud it was heard 4,800 km away in Australia and lowered global temperatures for a year.', narration: 'Indonesia has 127 active volcanoes. Krakatoa\'s eruption was heard 4,800 km away.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Indonesia is the world\'s largest Muslim-majority country but has a secular constitution — a deliberate choice at independence in 1945. Managing religious diversity across 1,300 ethnic groups and 700 languages is its greatest national challenge.', narration: 'The world\'s largest Muslim country chose a secular constitution — a unique democratic experiment.' },
    ],
    wonderType: 'size', whatIf: 'What if Indonesia were one connected landmass?',
  },
  {
    key: 'uae', name: 'UAE', continent: 'asia', lat: 24.5, lng: 54.4,
    capital: 'Abu Dhabi', population: '10 million', area: '83,600 km²', flag: '🇦🇪', color: '#6EE7B7',
    narration: 'The United Arab Emirates — a desert federation that transformed from pearl diving to global aviation hub in barely two generations.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Dubai\'s Burj Khalifa is so tall (828m) that you can watch the sunset from the base, take a lift to the top, and watch it set a second time. The city did not exist as a modern metropolis 60 years ago — it was a small pearl diving village.', narration: 'From the Burj Khalifa you can watch the sun set twice. 60 years ago Dubai was a fishing village.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Dubai International Airport is the world\'s busiest airport by international passengers. The UAE positioned itself at the exact centre of a circle containing two-thirds of the world\'s population within an 8-hour flight.', narration: 'The UAE put itself at the geographic centre of the world\'s airline routes.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Over 88% of UAE residents are expatriates — among the highest proportions anywhere on Earth. The UAE built a modern economy almost entirely with imported labour. The long-term social implications of a majority foreign workforce are still unfolding.', narration: 'Over 88% of UAE residents are foreigners. No other country is so built on imported people.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Dubai had never discovered oil?',
  },
  {
    key: 'singapore', name: 'Singapore', continent: 'asia', lat: 1.3, lng: 103.8,
    capital: 'Singapore City', population: '5.9 million', area: '728 km²', flag: '🇸🇬', color: '#FDE68A',
    narration: 'Singapore — a city-state smaller than London that became one of the world\'s richest countries by making itself the most efficient place on Earth to do business.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Singapore has no natural resources, no farmland, and must import its drinking water from Malaysia. Yet it has higher GDP per person than the UK, USA, or Germany. It turned its limitations into advantages by focusing entirely on being a trusted hub.', narration: 'Singapore has no natural resources or farmland — yet it\'s richer per person than the USA.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Singapore was declared independent against its will in 1965 — Malaysia expelled it from the federation. Its founding leader Lee Kuan Yew reportedly wept on television. Within 30 years Singapore had the world\'s best airport, port, and education system.', narration: 'Singapore was expelled from Malaysia in 1965. Its founder wept. Thirty years later it had the world\'s best airport.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Singapore\'s government is democratic but essentially one-party — the PAP has won every election since 1959. It achieves results (low corruption, world-class infrastructure, high wages) by controlling media and limiting opposition. It challenges assumptions about democracy and development.', narration: 'Singapore challenges the assumption that democracy and development always go together.' },
    ],
    wonderType: 'trade', whatIf: 'What if Singapore had stayed part of Malaysia?',
  },
  {
    key: 'vietnam', name: 'Vietnam', continent: 'asia', lat: 21.0, lng: 105.8,
    capital: 'Hanoi', population: '98 million', area: '331,200 km²', flag: '🇻🇳', color: '#FCA5A5',
    narration: 'Vietnam — an S-shaped country that defeated three superpowers, rebuilt itself from devastation, and became one of the fastest-growing economies in Asia.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Vietnam defeated France (1954), the United States (1975), and repelled a Chinese invasion (1979) — three major military victories in 25 years. Yet 20 years after the US war ended, McDonald\'s opened in Hanoi. Today Vietnam is one of America\'s major trade partners.', narration: 'Vietnam defeated France, the USA, and China in 25 years — then opened McDonald\'s 20 years later.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Ha Long Bay in northern Vietnam contains nearly 2,000 islands rising dramatically from the sea, formed over 500 million years. It is a UNESCO World Heritage Site and one of the natural wonders of the world.', narration: 'Ha Long Bay\'s 2,000 islands took 500 million years to form.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Vietnam\'s 1986 "Doi Moi" (Renovation) reforms opened its economy to markets while keeping the Communist Party in power. This hybrid model transformed one of the world\'s poorest countries to a middle-income nation in a generation — similar to China\'s approach, on a smaller scale.', narration: 'Vietnam\'s hybrid communist-market economy turned poverty to middle-income in one generation.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Vietnam had lost the American War?',
  },
  {
    key: 'thailand', name: 'Thailand', continent: 'asia', lat: 13.8, lng: 100.5,
    capital: 'Bangkok', population: '72 million', area: '513,100 km²', flag: '🇹🇭', color: '#FDE68A',
    narration: 'Thailand — the only Southeast Asian country never colonised by a European power, a kingdom of golden temples, street food, and extraordinary resilience.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Thailand\'s full ceremonial name for its capital is the longest place name in the world: 169 characters in Thai, translated roughly as "City of Angels, Great City, Eternal City of Jewels." Bangkok residents just call it Krung Thep.', narration: 'Bangkok\'s full name is 169 characters long — the world\'s longest place name.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Thailand is the world\'s largest exporter of rice and rubber. Its food — pad thai, green curry, mango sticky rice — is now eaten in restaurants on every continent. Thai street food culture was listed by UNESCO as intangible cultural heritage.', narration: 'Thailand feeds the world with rice, rubber, and a cuisine eaten on every continent.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Thailand avoided colonisation by playing Britain and France against each other while modernising rapidly. Its kings deliberately adopted western dress and diplomatic norms while retaining independence. This strategy of "bamboo diplomacy" is still studied today.', narration: 'Thailand stayed free by playing empires against each other — bamboo diplomacy at its finest.' },
    ],
    wonderType: 'trade', whatIf: 'What if Thailand had been colonised by Britain?',
  },
  {
    key: 'pakistan', name: 'Pakistan', continent: 'asia', lat: 33.7, lng: 73.1,
    capital: 'Islamabad', population: '231 million', area: '881,900 km²', flag: '🇵🇰', color: '#86EFAC',
    narration: 'Pakistan — a young nation born from partition in 1947, home to K2 and some of the world\'s oldest civilisations, and the world\'s fifth most populous country.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Pakistan contains five of the world\'s fourteen 8,000m+ mountains, including K2 — the second highest peak on Earth and considered more dangerous than Everest. Its name means "Pure Land" in Urdu.', narration: 'Pakistan contains five of the world\'s highest 14 mountains, including the deadlier-than-Everest K2.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Indus Valley Civilisation, which flourished in modern-day Pakistan 5,000 years ago, had running water, sewage systems, and planned grid cities when London was a bog. Mohenjo-daro may have housed 40,000 people.', narration: 'Pakistan\'s ancient Indus Valley cities had running water 5,000 years ago.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Pakistan and India have nuclear weapons pointed at each other over the disputed territory of Kashmir. Their two-hour war window — the time missiles take to arrive — has made crisis management one of the most studied problems in international security.', narration: 'Pakistan and India\'s nuclear standoff over Kashmir is one of the world\'s most studied security problems.' },
    ],
    wonderType: 'extremes', whatIf: 'What if India and Pakistan had never been partitioned?',
  },
  {
    key: 'iran', name: 'Iran', continent: 'asia', lat: 35.7, lng: 51.4,
    capital: 'Tehran', population: '88 million', area: '1,648,200 km²', flag: '🇮🇷', color: '#A78BFA',
    narration: 'Iran — home to one of the world\'s oldest continuous civilisations, where the Persian Empire once stretched from Egypt to India.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The Persian Empire under Cyrus the Great (559–530 BCE) issued the world\'s first known declaration of human rights — the Cyrus Cylinder. Cyrus freed slaves, allowed religious freedom, and returned displaced peoples to their homelands, 2,500 years before the UN Declaration.', narration: 'Persia issued the world\'s first human rights declaration 2,500 years before the United Nations.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Persia\'s "Royal Road" stretched 2,700 km from Susa to Sardis. Royal couriers could travel it in 7 days using relay stations — so fast that Herodotus marvelled at it. Herodotus\'s description inspired the US Postal Service motto: "Neither snow nor rain...".', narration: 'Persia\'s Royal Road inspired the US Postal Service motto, written 2,500 years earlier.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Iran has the world\'s second largest natural gas reserves and fourth largest oil reserves, yet faces economic hardship due to decades of international sanctions. It shows how geopolitical decisions can determine whether natural wealth translates into prosperity.', narration: 'Iran has the world\'s second largest gas reserves yet struggles economically due to sanctions.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Persia had never declined?',
  },

  // ── AFRICA ───────────────────────────────────────────────────────────────────
  {
    key: 'south-africa', name: 'South Africa', continent: 'africa', lat: -25.7, lng: 28.2,
    capital: 'Pretoria', population: '60 million', area: '1,219,100 km²', flag: '🇿🇦', color: '#FDE68A',
    narration: 'South Africa — the Rainbow Nation, home to Nelson Mandela, the world\'s most biodiverse floral kingdom, and a story of peaceful democratic transformation.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'South Africa is the only country in the world to have voluntarily dismantled its nuclear weapons programme. After building six nuclear bombs during apartheid, the new democratic government chose to destroy them all — a unique moment in history.', narration: 'South Africa built nuclear bombs — then chose to destroy all six when democracy arrived.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Nelson Mandela spent 27 years in prison and emerged to negotiate a peaceful transition from apartheid to democracy. South Africa\'s Truth and Reconciliation Commission became a global model for how societies heal after atrocity.', narration: 'Mandela\'s Truth and Reconciliation Commission became the world\'s model for healing after injustice.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'South Africa has the world\'s most unequal society by the Gini coefficient — apartheid created a wealth gap so deep that 30 years of democracy have barely closed it. It shows how economic inequality, once entrenched, resists political solutions.', narration: 'Apartheid\'s wealth gap survived democracy intact — one of the world\'s lessons in how inequality endures.' },
    ],
    wonderType: 'extremes', whatIf: 'What if apartheid had never ended peacefully?',
  },
  {
    key: 'nigeria', name: 'Nigeria', continent: 'africa', lat: 9.1, lng: 7.5,
    capital: 'Abuja', population: '220 million', area: '923,800 km²', flag: '🇳🇬', color: '#86EFAC',
    narration: 'Nigeria — Africa\'s most populous nation, the continent\'s largest economy, and home to Nollywood, the world\'s second-largest film industry.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Nigeria\'s Nollywood produces over 2,500 films a year — more than Hollywood, second only to Bollywood. Nigerian films, music (Afrobeats), and art are reshaping global culture from Lagos to London.', narration: 'Nollywood makes more films per year than Hollywood — and Afrobeats is reshaping world music.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Benin Kingdom (in modern Nigeria) was producing some of the world\'s finest bronze and ivory artwork in the 1300s, centuries before European contact. Many of these "Benin Bronzes" are now in British museums — their return is a major ongoing debate.', narration: 'Nigeria\'s Benin Kingdom was producing world-class bronze art in the 1300s. Much of it is now in British museums.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'By 2050 Nigeria is projected to be the world\'s third most populous country with 400 million people. How it manages urbanisation, agriculture, and climate stress in the next 30 years may be the most important development story of the 21st century.', narration: 'Nigeria may become the world\'s third most populous country by 2050. Its next 30 years will shape the century.' },
    ],
    wonderType: 'population', whatIf: 'What if Nigeria had been unified differently at independence?',
  },
  {
    key: 'egypt', name: 'Egypt', continent: 'africa', lat: 30.1, lng: 31.2,
    capital: 'Cairo', population: '104 million', area: '1,001,400 km²', flag: '🇪🇬', color: '#FCD34D',
    narration: 'Egypt — the cradle of one of history\'s greatest civilisations, where pharaohs built monuments that have survived 4,500 years.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The Great Pyramid of Giza was the world\'s tallest man-made structure for 3,800 years — from its completion in 2560 BCE until Lincoln Cathedral was built in 1311 CE. It contains 2.3 million stone blocks, each weighing up to 80 tonnes.', narration: 'The Great Pyramid was the world\'s tallest structure for 3,800 years.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Ancient Egyptians invented 365-day calendars, hieroglyphic writing, and advanced medicine. The Ebers Papyrus (1550 BCE) describes over 700 medical remedies — including treatments for asthma, diabetes, and heart disease.', narration: 'Ancient Egyptians had 700 medical treatments written down 3,500 years ago.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'The Suez Canal, completed in 1869, halved shipping distances between Europe and Asia. When a container ship blocked it for 6 days in 2021, it cost £7 billion per day in delayed global trade — showing how a single geographic chokepoint holds world commerce hostage.', narration: 'When one ship blocked the Suez Canal for 6 days in 2021, it cost £7 billion per day in global trade.' },
    ],
    wonderType: 'extremes', whatIf: 'What if ancient Egyptian civilisation had never declined?',
  },
  {
    key: 'kenya', name: 'Kenya', continent: 'africa', lat: -1.3, lng: 36.8,
    capital: 'Nairobi', population: '55 million', area: '580,400 km²', flag: '🇰🇪', color: '#6EE7B7',
    narration: 'Kenya — the cradle of humanity itself, where the earliest Homo sapiens fossils were found, and home to the Maasai, the Rift Valley, and the Great Migration.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The Serengeti/Masai Mara ecosystem hosts the Great Migration — 1.5 million wildebeest and hundreds of thousands of zebras moving in a loop between Tanzania and Kenya every year. It is the largest land-animal migration on Earth.', narration: '1.5 million wildebeest walk the same circular route every year — the greatest migration on Earth.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Turkana in northern Kenya produced "Turkana Boy" — an almost complete skeleton of a 1.6-million-year-old Homo erectus. The Rift Valley has yielded more human ancestor fossils than anywhere else on Earth.', narration: 'Kenya\'s Rift Valley has produced more human ancestor fossils than anywhere on Earth.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Kenya is Africa\'s hub for mobile money. M-Pesa, launched in 2007, lets people bank by phone without a bank account. Over 70% of Kenya\'s adults use it — more than most European countries use digital banking. Kenya leapfrogged legacy infrastructure entirely.', narration: 'Kenya\'s M-Pesa mobile money system is used more widely than digital banking in most of Europe.' },
    ],
    wonderType: 'population', whatIf: 'What if humans had first evolved somewhere other than Africa?',
  },
  {
    key: 'morocco', name: 'Morocco', continent: 'africa', lat: 33.9, lng: -6.9,
    capital: 'Rabat', population: '37 million', area: '446,600 km²', flag: '🇲🇦', color: '#FCA5A5',
    narration: 'Morocco — gateway between Europe and Africa, a kingdom of ancient medinas, Saharan dunes, and one of the oldest universities in the world.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The University of al-Qarawiyyin in Fez, Morocco, founded in 859 CE, is the world\'s oldest continuously operating university — 400 years older than Oxford. It was founded by a woman, Fatima al-Fihri.', narration: 'The world\'s oldest university was founded in Morocco in 859 CE — by a woman.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Morocco is separated from Spain by only 14 km of water at the Strait of Gibraltar — Europe and Africa almost touching. Moroccan and Spanish cultures, foods, and architecture have been entwined for over 700 years of Moorish history.', narration: 'Europe and Africa are just 14 km apart at the Strait of Gibraltar where Morocco meets Spain.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Morocco is positioning itself as a renewable energy hub — building the world\'s largest solar power plant in the Sahara. The Noor complex already exports electricity to Europe. The Sahara receives enough sunlight to power the world many times over.', narration: 'Morocco is turning the Sahara\'s sun into electricity it sells to Europe.' },
    ],
    wonderType: 'climate', whatIf: 'What if Moorish Spain had never been reconquered?',
  },
  {
    key: 'ethiopia', name: 'Ethiopia', continent: 'africa', lat: 9.0, lng: 38.7,
    capital: 'Addis Ababa', population: '124 million', area: '1,104,300 km²', flag: '🇪🇹', color: '#FDE68A',
    narration: 'Ethiopia — the only African country to never be colonised, the land where coffee was discovered, and where archaeologists found our oldest human ancestors.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Coffee was discovered in Ethiopia. According to legend, a goat herder named Kaldi noticed his goats became unusually energetic after eating berries from a certain tree. That tree was Coffea arabica. Today, coffee is the world\'s second most traded commodity after oil.', narration: 'Coffee was discovered in Ethiopia — and became the world\'s second most traded commodity.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: '"Lucy" — a 3.2-million-year-old Australopithecus skeleton found in Ethiopia in 1974 — transformed understanding of human evolution. She walked upright, proving bipedalism predated our large brains by millions of years.', narration: 'Lucy, Ethiopia\'s 3.2-million-year-old skeleton, proved we walked upright before we grew our big brains.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Ethiopia defeated Italy at the Battle of Adwa in 1896 — becoming the symbol of African resistance to colonisation. This victory inspired Pan-African movements worldwide, from Marcus Garvey to the architects of African independence.', narration: 'Ethiopia defeated Italy in 1896 — the only African victory against colonial invasion, inspiring generations.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Ethiopia had been colonised like the rest of Africa?',
  },

  // ── NORTH AMERICA ────────────────────────────────────────────────────────────
  {
    key: 'usa', name: 'United States', continent: 'north-america', lat: 38.9, lng: -77.0,
    capital: 'Washington D.C.', population: '335 million', area: '9,833,500 km²', flag: '🇺🇸', color: '#F87171',
    narration: 'The United States — a nation of immigrants that became the world\'s dominant economic and military power in barely 200 years.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The US economy is so large that if California were a country, it would be the world\'s 5th largest economy. The US spends more on defence than the next 10 countries combined. And yet 37 million Americans live in poverty.', narration: 'California alone would be the world\'s 5th largest economy. The US contains multitudes.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Moon landing (July 1969) was one of history\'s greatest achievements: 400,000 people worked on Apollo. Neil Armstrong\'s first words from the Moon were broadcast to 530 million people — a fifth of the world\'s population watching live.', narration: 'The Moon landing was watched live by a fifth of the world\'s population.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'The US invented the internet, GPS, the iPhone, and social media — technologies that restructured global society. Yet it struggles to agree on healthcare, gun policy, and climate. The paradox of a country that innovates globally but deadlocks domestically.', narration: 'The country that invented the internet struggles to agree on healthcare.' },
    ],
    wonderType: 'size', whatIf: 'What if the USA had remained part of the British Empire?',
  },
  {
    key: 'canada', name: 'Canada', continent: 'north-america', lat: 45.4, lng: -75.7,
    capital: 'Ottawa', population: '38 million', area: '9,984,700 km²', flag: '🇨🇦', color: '#FCA5A5',
    narration: 'Canada — the world\'s second largest country by area, with 20% of Earth\'s fresh water, more lakes than the rest of the world combined, and a mosaic of cultures.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Canada has more lakes than every other country on Earth combined — over 60% of the world\'s lakes are Canadian. It also has the world\'s longest coastline at 202,080 km, and more freshwater than any nation.', narration: 'Canada has more lakes than the rest of the world combined and the longest coastline on Earth.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Canadian province of Quebec is one of the world\'s few entirely French-speaking societies outside France. It has its own distinct legal system, cuisine, and cinema — within a larger English-speaking federation.', narration: 'Quebec is a French civilisation inside an English-speaking country, and it works.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Canada\'s policy of official multiculturalism (1971) was the world\'s first — legally mandating the preservation of all cultural heritages. It has made Canada one of the world\'s most welcoming immigrant nations, a deliberate contrast to US melting-pot ideology.', narration: 'Canada was the first country to legally mandate multiculturalism — a different model from the US.' },
    ],
    wonderType: 'size', whatIf: 'What if Canada had joined the United States?',
  },
  {
    key: 'mexico', name: 'Mexico', continent: 'north-america', lat: 19.4, lng: -99.1,
    capital: 'Mexico City', population: '130 million', area: '1,964,400 km²', flag: '🇲🇽', color: '#86EFAC',
    narration: 'Mexico — heir to the Aztec Empire, birthplace of chocolate and tomatoes, and a country where ancient ruins stand in the shadows of modern cities.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Mexico gave the world chocolate, tomatoes, corn, vanilla, avocados, and chilli peppers. Before the Columbian Exchange, none of these existed in Europe. European cuisine — including Italian tomato sauce and Swiss chocolate — would not exist without Mexico.', narration: 'Mexico gave Europe tomatoes, chocolate, corn, and chilli. Italian food would not exist without Mexico.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Aztec capital Tenochtitlan (now Mexico City) was one of the world\'s largest cities when Cortes arrived in 1519 — with 200,000 inhabitants, more than London or Paris at the time. It had running water, floating gardens, and a complex bureaucracy.', narration: 'When Spanish conquistadors arrived, Aztec Mexico City was larger than London.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Mexico City is sinking — built on a former lake bed, it sinks 30 cm per year in some areas. The Aztecs drained the lake; Spanish colonists drained it further; modern extraction of groundwater accelerated the sinking. It is now 10 metres lower than when the Spanish arrived.', narration: 'Mexico City is sinking 30cm per year — built on a lake the Aztecs drained 500 years ago.' },
    ],
    wonderType: 'extremes', whatIf: 'What if the Aztec Empire had survived the Spanish conquest?',
  },

  // ── SOUTH AMERICA ─────────────────────────────────────────────────────────────
  {
    key: 'brazil', name: 'Brazil', continent: 'south-america', lat: -15.8, lng: -47.9,
    capital: 'Brasília', population: '215 million', area: '8,515,800 km²', flag: '🇧🇷', color: '#34D399',
    narration: 'Brazil — the Amazon\'s home, football\'s spiritual capital, and the world\'s most biodiverse country, where half of South America\'s landmass is a single country.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'The Amazon rainforest, 60% of which is in Brazil, produces 20% of the world\'s oxygen and holds 10% of all species on Earth. Scientists estimate there are still thousands of species in the Amazon that science has never described.', narration: 'The Amazon produces 20% of Earth\'s oxygen and contains 10% of all known species.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Brazil is the only country in the Americas colonised by Portugal rather than Spain, giving it a distinct culture, language, and identity. The entire country of Brazil, speaking Portuguese, is larger than the continental USA.', narration: 'Brazil speaks Portuguese — because the Pope divided the New World between Spain and Portugal in 1494.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Brazil runs on sugarcane ethanol. Over 70% of new cars sold in Brazil can run on either petrol or ethanol. This energy independence programme, started after the 1973 oil crisis, shows how agricultural economies can solve energy problems differently.', narration: 'Brazil runs most of its cars on sugarcane ethanol — a homegrown solution to the oil crisis.' },
    ],
    wonderType: 'size', whatIf: 'What if the Amazon rainforest were completely deforested?',
  },
  {
    key: 'argentina', name: 'Argentina', continent: 'south-america', lat: -34.6, lng: -58.4,
    capital: 'Buenos Aires', population: '46 million', area: '2,780,400 km²', flag: '🇦🇷', color: '#7DD3FC',
    narration: 'Argentina — land of Patagonia, tango, and Messi, a country that was once richer than France and still has a complicated relationship with its potential.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Patagonia in southern Argentina is one of the world\'s last great wildernesses — penguins, pumas, condors, and the world\'s largest glacier outside the poles. The Torres del Paine mountains rise so dramatically from the flat steppe they seem unreal.', narration: 'Patagonia — penguins, pumas, condors, and glaciers at the end of the world.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'In 1913 Argentina was richer than France and one of the world\'s top 10 economies. A century of economic mismanagement, military coups, and hyperinflation reduced it. Understanding Argentina is understanding how quickly prosperity can be squandered.', narration: 'Argentina was richer than France in 1913. Understanding its decline is studying how wealth can vanish.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Argentina has defaulted on its national debt nine times — more than any other country. Each default is followed by austerity, recovery, and then another crisis. Economists study Argentina to understand the limits of economic reform without institutional change.', narration: 'Argentina has defaulted on its debt nine times — the world\'s most studied case of economic self-destruction.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Argentina had maintained its early 20th century prosperity?',
  },
  {
    key: 'colombia', name: 'Colombia', continent: 'south-america', lat: 4.7, lng: -74.1,
    capital: 'Bogotá', population: '51 million', area: '1,141,700 km²', flag: '🇨🇴', color: '#FDE68A',
    narration: 'Colombia — once known only for its troubles, now one of the fastest-growing tourism destinations in the world, a country reinventing itself.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Colombia is the only country in South America with both Pacific and Atlantic coastlines. It is one of the world\'s 17 "megadiverse" countries, home to 10% of all plant species on Earth despite covering less than 1% of the planet\'s surface.', narration: 'Colombia has both Pacific and Atlantic coasts and 10% of Earth\'s plant species.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Colombia produces 95% of the world\'s emeralds. It is also the world\'s largest cut flower exporter after the Netherlands — growing flowers in its highland climate, flying them to Miami, and selling them across the USA within 24 hours.', narration: 'Colombia grows 95% of the world\'s emeralds and is the world\'s second largest flower exporter.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'The 2016 peace agreement ending 52 years of FARC guerrilla war was rejected in a referendum, then signed anyway. Colombia\'s peace process is one of the most studied post-conflict transitions — showing the complexity of ending a war when society is divided about how.', narration: 'Colombia\'s 2016 peace deal ended 52 years of war — then voters rejected it, but it was signed anyway.' },
    ],
    wonderType: 'climate', whatIf: 'What if the Colombian peace deal had never been signed?',
  },
  {
    key: 'chile', name: 'Chile', continent: 'south-america', lat: -33.5, lng: -70.7,
    capital: 'Santiago', population: '19 million', area: '756,100 km²', flag: '🇨🇱', color: '#FCA5A5',
    narration: 'Chile — the world\'s longest and skinniest country, stretching 4,300 km from desert to Antarctic ice, a sliver of land squeezed between the Andes and the Pacific.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Chile is 4,300 km long but averages only 177 km wide — longer than the distance from London to Cairo but barely wider than Wales. It contains the driest place on Earth (Atacama Desert) and the world\'s clearest night skies.', narration: 'Chile is as long as London to Cairo but barely wider than Wales — the world\'s strangest-shaped country.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'The Atacama Desert in northern Chile is so dry that some areas have never recorded rainfall. But it is also where 70% of the world\'s astronomical observations are made — the altitude and lack of light pollution make Chile\'s skies the clearest on Earth.', narration: '70% of the world\'s astronomical observations happen in Chile\'s uniquely clear desert skies.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Chile has the world\'s largest copper reserves — 27% of global supply. Lithium, the material in all electric car batteries, is also found here in huge quantities in the Atacama salt flats. Chile may be to the electric vehicle era what Saudi Arabia was to the oil era.', narration: 'Chile has 27% of the world\'s copper and huge lithium reserves — the Saudi Arabia of the electric car age.' },
    ],
    wonderType: 'extremes', whatIf: 'What if Chile\'s lithium reserves ran out before EVs took over?',
  },

  // ── OCEANIA ──────────────────────────────────────────────────────────────────
  {
    key: 'australia', name: 'Australia', continent: 'oceania', lat: -35.3, lng: 149.1,
    capital: 'Canberra', population: '26 million', area: '7,741,200 km²', flag: '🇦🇺', color: '#FB923C',
    narration: 'Australia — a continent-country where 80% of wildlife exists nowhere else on Earth, and whose Indigenous peoples maintained the world\'s oldest continuous culture for 65,000 years.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'Australia\'s Great Barrier Reef is the world\'s largest living structure — 2,300 km long, visible from space, and containing more biodiversity than the entire North Atlantic Ocean. It is 500,000 years old and currently bleaching due to climate change.', narration: 'The Great Barrier Reef is 2,300 km long, visible from space, and dying from climate change.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'Australian Indigenous peoples have the world\'s oldest continuous culture, stretching back at least 65,000 years. Their oral histories accurately described sea level changes from the end of the last Ice Age — stories passed down through 300 generations.', narration: 'Aboriginal Australians passed down accurate sea level histories through 300 generations of oral storytelling.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'Australia exports more coal than any other country — and is also one of the countries most threatened by climate change. This contradiction drives its sharpest political debates: the coal towns of Queensland vs the reef-dependent communities of the coast.', narration: 'Australia is the world\'s largest coal exporter and one of climate change\'s biggest victims at the same time.' },
    ],
    wonderType: 'size', whatIf: 'What if Aboriginal Australians had maintained sovereignty?',
  },
  {
    key: 'new-zealand', name: 'New Zealand', continent: 'oceania', lat: -41.3, lng: 174.8,
    capital: 'Wellington', population: '5 million', area: '268,000 km²', flag: '🇳🇿', color: '#6EE7B7',
    narration: 'New Zealand — the last large landmass settled by humans, a place where evolution ran a different experiment for 80 million years without mammals.',
    layers: [
      { id: 1, label: 'Wonder', icon: '✨', content: 'New Zealand was the last large habitable landmass on Earth to be settled by humans — Māori arrived only around 1250 CE. Before humans arrived, the islands had no land mammals whatsoever. Instead, birds filled every ecological role, including giant moas taller than a person.', narration: 'New Zealand had no mammals until 750 years ago — birds filled every ecological role instead.' },
      { id: 2, label: 'Explorer', icon: '🔭', content: 'New Zealand was the first country to give women the right to vote (1893), the first to have a female prime minister twice (Jenny Shipley, Helen Clark), and one of the first to legalise same-sex marriage. It consistently leads on social policy.', narration: 'New Zealand was the world\'s first country to give women the vote, in 1893.' },
      { id: 3, label: 'Deep Dive', icon: '🧠', content: 'The Treaty of Waitangi (1840) between the British Crown and Māori chiefs is New Zealand\'s founding document. Unlike most colonial treaties, it is still active — Māori regularly use it to reclaim land and cultural rights in court, making New Zealand\'s colonial reckoning ongoing.', narration: 'New Zealand\'s 1840 treaty with Māori is still used in court today — a living colonial reckoning.' },
    ],
    wonderType: 'extremes', whatIf: 'What if New Zealand had never been settled by humans?',
  },
]

// ─── Three.js Components ──────────────────────────────────────────────────────

function EarthSphere() {
  const earthTexture = useLoader(THREE.TextureLoader, '/textures/earth.jpg')
  return (
    <mesh>
      <sphereGeometry args={[2.5, 64, 64]} />
      <meshStandardMaterial map={earthTexture} roughness={0.7} metalness={0.1} />
    </mesh>
  )
}

function AtmosphereGlow() {
  return (
    <mesh>
      <sphereGeometry args={[2.58, 32, 32]} />
      <meshStandardMaterial
        color="#4FC3F7"
        transparent
        opacity={0.08}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

function CountryMarker({ country, isSelected, onSelect }: {
  country: Country
  isSelected: boolean
  onSelect: (c: Country) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const pos = latLngTo3D(country.lat, country.lng, 2.54)
  const glowRef = useRef<THREE.Mesh>(null)
  const t = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    t.current += delta * 1.5
    if (glowRef.current) {
      glowRef.current.scale.setScalar(isSelected ? 1.5 + Math.sin(t.current) * 0.3 : 1.0)
    }
  })

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      {/* Glow ring */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[isSelected ? 0.07 : 0.055, 16, 16]} />
        <meshBasicMaterial
          color={country.color}
          transparent
          opacity={isSelected ? 0.5 : 0.3}
        />
      </mesh>
      {/* Core dot */}
      <mesh
        ref={meshRef}
        onPointerUp={(e) => { e.stopPropagation(); onSelect(country) }}
      >
        <sphereGeometry args={[isSelected ? 0.06 : 0.042, 12, 12]} />
        <meshBasicMaterial color={isSelected ? '#FFFFFF' : country.color} />
      </mesh>
    </group>
  )
}

function GlobeController({ cameraLat, cameraLng }: { cameraLat: number; cameraLng: number }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 0, 7.5))

  useFrame((_, delta) => {
    const newPos = latLngTo3D(cameraLat, cameraLng, 7.5)
    newPos.y = Math.max(newPos.y, -4)
    target.current.lerp(newPos, delta * 1.8)
    camera.position.copy(target.current)
    camera.lookAt(0, 0, 0)
  })

  return null
}

interface GlobeSceneProps {
  countries: Country[]
  selectedCountry: Country | null
  cameraLat: number
  cameraLng: number
  onSelect: (c: Country) => void
  onBackgroundClick: () => void
}

function GlobeScene({ countries, selectedCountry, cameraLat, cameraLng, onSelect, onBackgroundClick }: GlobeSceneProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Stars radius={200} depth={60} count={4000} factor={4} saturation={0} fade speed={0.5} />
      <GlobeController cameraLat={cameraLat} cameraLng={cameraLng} />
      {/* Globe */}
      <group onPointerMissed={onBackgroundClick}>
        <EarthSphere />
        <AtmosphereGlow />
        {countries.map(c => (
          <CountryMarker
            key={c.key}
            country={c}
            isSelected={selectedCountry?.key === c.key}
            onSelect={onSelect}
          />
        ))}
      </group>
    </>
  )
}

// ─── Wonder Overlay (inline) ──────────────────────────────────────────────────

const WONDER_CONTENT: Record<WonderType, { title: string; description: string; render: () => React.ReactNode }> = {
  population: {
    title: 'World Population Scale',
    description: 'How the world\'s 8 billion people are distributed',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { label: 'Asia', pct: 60, color: '#A78BFA' },
          { label: 'Africa', pct: 18, color: '#FBBF24' },
          { label: 'Europe', pct: 9, color: '#6C9EFF' },
          { label: 'Americas', pct: 13, color: '#F87171' },
        ].map((r, i) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-16 text-right">{r.label}</span>
            <motion.div
              className="h-6 rounded-full flex items-center pl-2"
              style={{ background: r.color }}
              initial={{ width: 0 }}
              animate={{ width: `${r.pct * 2.5}px` }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="text-[10px] font-bold text-black/80">{r.pct}%</span>
            </motion.div>
          </div>
        ))}
        <p className="text-xs text-white/40 mt-3 text-center">Total: 8 billion people</p>
      </div>
    ),
  },
  size: {
    title: 'Country Size Comparison',
    description: 'How countries compare in area to the UK (243,000 km²)',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { label: 'Russia', mult: 70.4, color: '#FCA5A5' },
          { label: 'Australia', mult: 31.9, color: '#FB923C' },
          { label: 'USA', mult: 40.5, color: '#F87171' },
          { label: 'Brazil', mult: 35.1, color: '#34D399' },
          { label: 'UK', mult: 1, color: '#6C9EFF' },
        ].map((r, i) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-white/50 w-16 text-right">{r.label}</span>
            <motion.div
              className="h-5 rounded-sm flex items-center pl-2"
              style={{ background: r.color, maxWidth: '180px' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(r.mult * 2.5, 180)}px` }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="text-[9px] font-bold text-black/80">{r.mult}×</span>
            </motion.div>
          </div>
        ))}
      </div>
    ),
  },
  climate: {
    title: 'Climate Zones',
    description: 'The 5 main climate zones of Earth',
    render: () => (
      <div className="grid grid-cols-1 gap-2 mt-4">
        {[
          { name: 'Tropical', emoji: '🌴', desc: 'Hot & wet year-round. 40% of Earth\'s species live here.', color: '#059669' },
          { name: 'Arid', emoji: '🏜️', desc: 'Hot & dry. Covers 30% of land — the Sahara, Arabian, Gobi.', color: '#D97706' },
          { name: 'Temperate', emoji: '🌿', desc: 'Mild seasons. Where most of Europe and China sit.', color: '#2563EB' },
          { name: 'Continental', emoji: '❄️', desc: 'Extreme seasons. Canada, Russia, Scandinavia.', color: '#7C3AED' },
          { name: 'Polar', emoji: '🧊', desc: 'Frozen year-round. Barely 0.1% of humans live here.', color: '#94A3B8' },
        ].map((z, i) => (
          <motion.div
            key={z.name}
            className="flex items-start gap-3 rounded-xl p-3"
            style={{ background: z.color + '22', border: `1px solid ${z.color}44` }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-xl">{z.emoji}</span>
            <div>
              <p className="text-sm font-bold text-white">{z.name}</p>
              <p className="text-xs text-white/60">{z.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  trade: {
    title: 'Global Trade Network',
    description: 'The world\'s biggest trading relationships',
    render: () => (
      <div className="space-y-3 mt-4">
        <p className="text-xs text-white/50">World trade is $32 trillion per year. Top trading pairs:</p>
        {[
          { pair: 'USA ↔ China', value: '$690bn', color: '#F87171' },
          { pair: 'Germany ↔ France', value: '$180bn', color: '#6C9EFF' },
          { pair: 'USA ↔ Mexico', value: '$800bn', color: '#34D399' },
          { pair: 'China ↔ Japan', value: '$330bn', color: '#A78BFA' },
          { pair: 'UK ↔ EU', value: '$850bn', color: '#FBBF24' },
        ].map((t, i) => (
          <motion.div
            key={t.pair}
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-sm text-white/80">{t.pair}</span>
            <span className="text-sm font-bold" style={{ color: t.color }}>{t.value}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  language: {
    title: 'World\'s Languages',
    description: 'Over 7,000 languages — half may disappear this century',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { family: 'Indo-European', speakers: '3.2bn', examples: 'English, Hindi, Spanish, Russian', color: '#6C9EFF' },
          { family: 'Sino-Tibetan', speakers: '1.4bn', examples: 'Mandarin, Cantonese, Tibetan', color: '#F87171' },
          { family: 'Afro-Asiatic', speakers: '500m', examples: 'Arabic, Amharic, Hebrew', color: '#FBBF24' },
          { family: 'Dravidian', speakers: '220m', examples: 'Tamil, Telugu, Kannada', color: '#34D399' },
          { family: 'All others', speakers: '2.7bn', examples: '6,900+ languages', color: '#A78BFA' },
        ].map((l, i) => (
          <motion.div
            key={l.family}
            className="rounded-lg p-2.5"
            style={{ background: l.color + '18', border: `1px solid ${l.color}30` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-white">{l.family}</span>
              <span className="text-xs font-bold" style={{ color: l.color }}>{l.speakers}</span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">{l.examples}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
  extremes: {
    title: 'Earth\'s Extremes',
    description: 'The most remarkable records on our planet',
    render: () => (
      <div className="space-y-2 mt-4">
        {[
          { record: 'Hottest place', value: '56.7°C', where: 'Death Valley, USA', emoji: '🌡️' },
          { record: 'Coldest place', value: '−89.2°C', where: 'Antarctica', emoji: '🥶' },
          { record: 'Wettest place', value: '11,862mm/yr', where: 'Mawsynram, India', emoji: '🌧️' },
          { record: 'Driest place', value: '0mm/yr', where: 'Atacama, Chile', emoji: '🏜️' },
          { record: 'Highest point', value: '8,849m', where: 'Everest, Nepal', emoji: '⛰️' },
          { record: 'Deepest ocean', value: '10,935m', where: 'Mariana Trench', emoji: '🌊' },
        ].map((r, i) => (
          <motion.div
            key={r.record}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-xl">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50">{r.record}</p>
              <p className="text-sm font-bold text-white">{r.value}</p>
            </div>
            <p className="text-xs text-white/40 text-right">{r.where}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
}

// ─── Panels ───────────────────────────────────────────────────────────────────

const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

function InfoPanel({ country, onClose, muted, onToggleMute }: {
  country: Country
  onClose: () => void
  muted: boolean
  onToggleMute: () => void
}) {
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3>(1)
  const [activeWonder, setActiveWonder] = useState<WonderType | null>(null)
  const layer = country.layers[activeLayer - 1]
  const continent = CONTINENTS[country.continent]

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(10,12,28,0.97) 0%, rgba(5,7,20,0.99) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none',
        maxHeight: '58vh',
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }}
      transition={{ duration: 0.42, ease: EASE_DRAWER }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      <div className="px-5 overflow-y-auto" style={{ maxHeight: 'calc(58vh - 48px)' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{country.flag}</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: continent.color }}>
                {continent.emoji} {continent.name}
              </p>
              <h2 className="font-heading text-2xl font-extrabold text-white leading-tight">{country.name}</h2>
              <p className="text-xs text-white/40">{country.capital} · {country.population}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full text-white/60 active:scale-95 transition-transform"
            style={{ minWidth: 40, minHeight: 40, background: 'rgba(255,255,255,0.08)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Narration */}
        <NarrationButton text={layer.narration} muted={muted} onToggleMute={onToggleMute} autoPlay />

        {/* Layer tabs */}
        <div className="flex gap-2 mt-4 mb-3">
          {country.layers.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveLayer(l.id)}
              className="flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95"
              style={{
                minHeight: 34,
                background: activeLayer === l.id ? 'rgba(108,158,255,0.25)' : 'rgba(255,255,255,0.07)',
                border: activeLayer === l.id ? '1px solid rgba(108,158,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: activeLayer === l.id ? '#6C9EFF' : 'rgba(255,255,255,0.5)',
              }}
            >
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        {/* Layer content */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeLayer}
            className="text-sm leading-relaxed text-white/80 mb-4"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {layer.content}
          </motion.p>
        </AnimatePresence>

        {/* Wonder trigger */}
        <button
          onClick={() => setActiveWonder(country.wonderType)}
          className="w-full rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(108,158,255,0.12)', border: '1px solid rgba(108,158,255,0.25)' }}
        >
          <span className="text-2xl">🌐</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Explore a world wonder</p>
            <p className="text-xs text-white/40">{WONDER_CONTENT[country.wonderType].title}</p>
          </div>
          <span className="ml-auto text-white/40">→</span>
        </button>

        {/* What if */}
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs text-white/40 mb-1">💭 What if…</p>
          <p className="text-sm text-white/70 italic">{country.whatIf}</p>
        </div>
      </div>

      {/* Wonder overlay */}
      <AnimatePresence>
        {activeWonder && (
          <motion.div
            className="absolute inset-0 rounded-t-3xl overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, rgba(8,10,25,0.98) 0%, rgba(5,7,20,0.99) 100%)',
              zIndex: 10,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="px-5 pt-4 pb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading text-lg font-bold text-white">
                  {WONDER_CONTENT[activeWonder].title}
                </h3>
                <button
                  onClick={() => setActiveWonder(null)}
                  className="text-white/50 text-lg active:scale-95 transition-transform"
                  style={{ minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-white/40 mb-2">{WONDER_CONTENT[activeWonder].description}</p>
              {WONDER_CONTENT[activeWonder].render()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function JourneyPanel({ step, total, continentKey, onNext, onStay, onFinish }: {
  step: number
  total: number
  continentKey: Continent
  onNext: () => void
  onStay: () => void
  onFinish: () => void
}) {
  const continent = CONTINENTS[continentKey]
  const isLast = step === total - 1
  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl"
      style={{
        background: 'linear-gradient(180deg, rgba(10,12,28,0.97) 0%, rgba(5,7,20,0.99) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderBottom: 'none',
        maxHeight: '44vh',
      }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%', transition: { duration: 0.22, ease: EASE_DRAWER } }}
      transition={{ duration: 0.42, ease: EASE_DRAWER }}
    >
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      <div className="px-5 pb-6">
        {/* Progress */}
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full flex-1 transition-all duration-500"
              style={{ background: i <= step ? continent.color : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{continent.emoji}</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: continent.color }}>
              Stop {step + 1} of {total}
            </p>
            <h2 className="font-heading text-xl font-extrabold text-white">{continent.name}</h2>
          </div>
        </div>

        <p className="text-sm text-white/70 mb-5">
          Tap a country marker to explore, or continue the journey.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white/70 active:scale-[0.97] transition-transform"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Stay here
          </button>
          <button
            onClick={isLast ? onFinish : onNext}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white active:scale-[0.97] transition-transform"
            style={{ background: `linear-gradient(135deg, ${continent.color}99, ${continent.color}66)`, border: `1px solid ${continent.color}40` }}
          >
            {isLast ? '🏆 Complete' : 'Next →'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorldAtlasProps {
  onAskDecifer?: (context: string) => void
  onExplore?: (key: string) => void
}

export function WorldAtlas({ onAskDecifer, onExplore }: WorldAtlasProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [filterContinent, setFilterContinent] = useState<Continent | null>(null)
  const [muted, setMuted] = useState(false)
  const [journeyStep, setJourneyStep] = useState<number | null>(null)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const [cameraLat, setCameraLat] = useState(20)
  const [cameraLng, setCameraLng] = useState(-10)

  const visitedRef = useRef<Set<string>>(new Set())
  const pendingCardRef = useRef<DroppedCard | null>(null)
  const autoOrbitRef = useRef(true)
  const orbitAngleRef = useRef(-10)

  const JOURNEY_CONTINENTS: Continent[] = ['europe', 'africa', 'asia', 'north-america', 'south-america', 'oceania']

  // Auto-orbit when nothing selected
  useEffect(() => {
    if (selectedCountry || journeyStep !== null) { autoOrbitRef.current = false; return }
    autoOrbitRef.current = true
    const interval = setInterval(() => {
      if (!autoOrbitRef.current) return
      orbitAngleRef.current += 0.15
      setCameraLng(orbitAngleRef.current % 360)
    }, 60)
    return () => clearInterval(interval)
  }, [selectedCountry, journeyStep])

  const handleSelectCountry = useCallback(async (country: Country) => {
    // If the pointer moved more than 5px total, this was a drag not a tap — ignore
    if (dragDistanceRef.current > 5) return
    stopNarration()
    setSelectedCountry(country)
    autoOrbitRef.current = false
    setCameraLat(country.lat)
    setCameraLng(country.lng)
    onExplore?.(country.key)

    if (!visitedRef.current.has(country.key)) {
      visitedRef.current.add(country.key)
      try {
        const res = await fetch('/api/explore/card-drop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aidType: 'world-atlas', topicKey: country.key }),
        })
        const data = await res.json()
        if (data.card) pendingCardRef.current = data.card
      } catch { /* ignore */ }
    }
  }, [onExplore])

  const handleClosePanel = useCallback(() => {
    stopNarration()
    setSelectedCountry(null)
    autoOrbitRef.current = true
    if (pendingCardRef.current) {
      const card = pendingCardRef.current
      pendingCardRef.current = null
      setTimeout(() => setRevealCard(card), 350)
    }
  }, [])

  const handleContinentSelect = (c: Continent) => {
    setFilterContinent(prev => prev === c ? null : c)
    autoOrbitRef.current = false
    setCameraLat(CONTINENTS[c].lat)
    setCameraLng(CONTINENTS[c].lng)
  }

  const startJourney = () => {
    setJourneyStep(0)
    setSelectedCountry(null)
    autoOrbitRef.current = false
    const c = CONTINENTS[JOURNEY_CONTINENTS[0]]
    setCameraLat(c.lat)
    setCameraLng(c.lng)
  }

  const journeyNext = () => {
    if (journeyStep === null) return
    const next = journeyStep + 1
    if (next >= JOURNEY_CONTINENTS.length) { journeyFinish(); return }
    setJourneyStep(next)
    const c = CONTINENTS[JOURNEY_CONTINENTS[next]]
    setCameraLat(c.lat)
    setCameraLng(c.lng)
  }

  const journeyFinish = async () => {
    setJourneyStep(null)
    autoOrbitRef.current = true
    try {
      await fetch('/api/explore/journey-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'world-atlas' }),
      })
    } catch { /* ignore */ }
  }

  const visibleCountries = filterContinent
    ? COUNTRIES.filter(c => c.continent === filterContinent)
    : COUNTRIES

  const currentJourneyContinent = journeyStep !== null ? JOURNEY_CONTINENTS[journeyStep] : null

  // ── Drag-to-rotate ──────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const dragActiveRef = useRef(false)
  const dragDistanceRef = useRef(0)
  const dragResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragActiveRef.current = true
    dragDistanceRef.current = 0
    setIsDragging(true)
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    autoOrbitRef.current = false
    if (dragResumeTimer.current) clearTimeout(dragResumeTimer.current)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragActiveRef.current) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    dragDistanceRef.current += Math.sqrt(dx * dx + dy * dy)
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    setCameraLng(prev => (prev - dx * 0.45) % 360)
    setCameraLat(prev => Math.max(-78, Math.min(78, prev + dy * 0.22)))
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!dragActiveRef.current) return
    dragActiveRef.current = false
    setIsDragging(false)
    // Resume auto-orbit after 10s if nothing is selected
    if (!selectedCountry && journeyStep === null) {
      dragResumeTimer.current = setTimeout(() => {
        autoOrbitRef.current = true
      }, 10000)
    }
  }, [selectedCountry, journeyStep])

  return (
    <div
      className="absolute inset-0"
      style={{ background: '#020408', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Globe — pointer events kept on so Three.js raycasting works for markers */}
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 48 }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <GlobeScene
          countries={visibleCountries}
          selectedCountry={selectedCountry}
          cameraLat={cameraLat}
          cameraLng={cameraLng}
          onSelect={handleSelectCountry}
          onBackgroundClick={handleClosePanel}
        />
      </Canvas>

      {/* Title */}
      {!selectedCountry && journeyStep === null && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">World Atlas</p>
        </div>
      )}

      {/* Journey button */}
      {!selectedCountry && journeyStep === null && (
        <motion.button
          onClick={startJourney}
          className="absolute z-10 rounded-2xl px-5 flex items-center gap-2 text-sm font-bold text-white active:scale-[0.97] transition-transform"
          style={{
            bottom: '88px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(108,158,255,0.3), rgba(108,158,255,0.15))',
            border: '1px solid rgba(108,158,255,0.4)',
            minHeight: 48,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          🌍 Take the World Tour
        </motion.button>
      )}

      {/* Continent tabs */}
      {!selectedCountry && journeyStep === null && (
        <div
          className="absolute bottom-0 left-0 right-0 z-10 pb-4 pt-2"
          style={{ background: 'linear-gradient(to top, rgba(2,4,8,0.95) 0%, transparent 100%)' }}
        >
          <div className="flex gap-2 px-4 overflow-x-auto scrollbar-none pb-1">
            {(Object.keys(CONTINENTS) as Continent[]).map((c, i) => {
              const meta = CONTINENTS[c]
              const active = filterContinent === c
              return (
                <motion.button
                  key={c}
                  onClick={() => handleContinentSelect(c)}
                  className="flex-none flex items-center gap-1.5 rounded-full px-4 text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
                  style={{
                    minHeight: 40,
                    background: active ? meta.color + '33' : 'rgba(255,255,255,0.08)',
                    border: active ? `1px solid ${meta.color}66` : '1px solid rgba(255,255,255,0.1)',
                    color: active ? meta.color : 'rgba(255,255,255,0.6)',
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.name}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Info panel */}
      <AnimatePresence>
        {selectedCountry && (
          <InfoPanel
            key={selectedCountry.key}
            country={selectedCountry}
            onClose={handleClosePanel}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
          />
        )}
      </AnimatePresence>

      {/* Journey panel */}
      <AnimatePresence>
        {journeyStep !== null && currentJourneyContinent && (
          <JourneyPanel
            key={journeyStep}
            step={journeyStep}
            total={JOURNEY_CONTINENTS.length}
            continentKey={currentJourneyContinent}
            onNext={journeyNext}
            onStay={() => { setJourneyStep(null); autoOrbitRef.current = true }}
            onFinish={journeyFinish}
          />
        )}
      </AnimatePresence>

      {/* Card reveal */}
      <AnimatePresence>
        {revealCard && (
          <CardReveal
            card={revealCard}
            onDismiss={() => setRevealCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
