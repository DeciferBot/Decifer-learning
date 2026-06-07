'use client'

import { useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Stars, Ring } from '@react-three/drei'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import { WonderOverlay, WONDER_LABELS } from './WonderOverlay'
import type { WonderType } from './WonderOverlay'
import type { DroppedCard } from '@/app/api/quiz/submit/route'

// ---------------------------------------------------------------------------
// Planet data
// ---------------------------------------------------------------------------

interface FactLayer {
  label: string       // "Wonder" | "Explorer" | "Deep Space"
  emoji: string
  text: string        // Main educational content
  narration: string   // Attenborough-style text for this layer
  whatIf: string      // Wonder prompt that pre-fills Ask Decifer
}

interface Planet {
  id: string
  name: string
  color: string
  glowColor: string
  radius: number          // Visual radius in Three.js units
  orbitRadius: number     // Distance from sun in Three.js units
  period: number          // Orbit period in seconds (visual, not real)
  moons: number
  diameter: string
  distanceFromSun: string
  orbitalPeriod: string
  fact: string
  description: string
  rings?: boolean
  texture: string         // filename in /textures/
  narration: string       // Layer 1 Attenborough narration (also used as default)
  layers: FactLayer[]     // Three depths of knowledge
  quizQuestion: string
  quizOptions: string[]
  quizAnswer: number
  quizExplanation: string
}

const PLANETS: Planet[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    color: '#b5b5b5',
    glowColor: '#d0d0d0',
    radius: 0.38,
    orbitRadius: 7,
    period: 8,
    moons: 0,
    diameter: '4,879 km',
    distanceFromSun: '57.9 million km',
    orbitalPeriod: '88 Earth days',
    fact: 'Mercury has no atmosphere, so temperatures swing from −180°C at night to 430°C during the day.',
    description: 'The smallest planet and closest to the Sun. Despite being closest to the Sun, it\'s not the hottest planet — that\'s Venus.',
    texture: 'mercury.jpg',
    narration: 'Mercury. The smallest world, and the closest to our star. It has no atmosphere to protect it — so by day, it bakes at four hundred degrees. By night, it plunges to minus one hundred and eighty. A world of extremes, battered and ancient.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'If you stood on Mercury, the Sun would look three times bigger than it does from Earth — and the temperature swings 610°C between day and night. No other planet in our Solar System has such extreme temperature changes.',
        narration: 'Standing on Mercury, the Sun would fill the sky — three times larger than we see it from Earth. And yet, without any atmosphere to hold that heat, the moment the Sun sets, the temperature plunges more than six hundred degrees. A world of the most extreme temperatures anywhere in the Solar System.',
        whatIf: 'What if Mercury had an atmosphere like Earth?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Mercury has no atmosphere because its gravity is too weak to hold one — and the solar wind constantly strips away any gas. This is why it cannot retain heat at night. Its surface is covered in craters from billions of years of asteroid impacts, preserved perfectly because there is no wind or rain to erode them.',
        narration: 'Mercury\'s gravity is only 38% of Earth\'s — too feeble to grip an atmosphere. Without that protective blanket, there is nothing to trap daytime heat, nothing to block cosmic rays, and nothing to erode the ancient craters that have accumulated over billions of years. It is the most cratered world in the inner solar system.',
        whatIf: 'Could Mercury ever have supported life in the past?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Scientists are puzzled by Mercury\'s enormous iron core — it makes up 85% of the planet\'s radius. One theory is that a giant impact long ago stripped away its outer layers. NASA\'s MESSENGER spacecraft discovered water ice in permanently shadowed craters near Mercury\'s poles. We still don\'t fully understand how it formed.',
        narration: 'Here is the mystery at Mercury\'s heart: its iron core is proportionally the largest of any planet. One theory holds that a colossal impact in the early solar system stripped most of its rocky mantle away. And stranger still — in the perpetually shadowed craters at its poles, there is water ice. On the closest planet to the Sun.',
        whatIf: 'What created Mercury\'s enormous iron core?',
      },
    ],
    quizQuestion: 'How long is a year on Mercury?',
    quizOptions: ['88 Earth days', '365 Earth days', '12 Earth years', '24 hours'],
    quizAnswer: 0,
    quizExplanation: 'Mercury orbits the Sun so quickly that a year there is only 88 Earth days!',
  },
  {
    id: 'venus',
    name: 'Venus',
    color: '#e8cda0',
    glowColor: '#f0d070',
    radius: 0.95,
    orbitRadius: 11,
    period: 14,
    moons: 0,
    diameter: '12,104 km',
    distanceFromSun: '108.2 million km',
    orbitalPeriod: '225 Earth days',
    fact: 'Venus spins backwards and so slowly that one Venus day is longer than a Venus year!',
    description: 'The hottest planet in our Solar System at 465°C, thanks to a thick atmosphere that traps heat.',
    texture: 'venus.jpg',
    narration: 'Venus. Shrouded in thick clouds of sulphuric acid, its surface reaches four hundred and sixty-five degrees — hot enough to melt lead. Strangely, a day on Venus lasts longer than its entire year. It is, in every sense, a world turned upside down.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Venus is hotter than Mercury, even though it\'s twice as far from the Sun. A day on Venus (243 Earth days) is longer than a year on Venus (225 Earth days). It also spins backwards — if you could see the Sun from its surface, it would rise in the west and set in the east.',
        narration: 'Closer to the Sun than Mercury — yet Mercury is hotter. Venus traps so much heat that its surface glows at four hundred and sixty-five degrees. And here is the strangest thing: a single Venusian day lasts longer than its entire year. Time itself seems to work differently on this world.',
        whatIf: 'What if Venus had oceans like Earth?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Venus has a runaway greenhouse effect. Its thick atmosphere of carbon dioxide traps nearly all solar energy, like a car left in the sun but taken to the extreme. The atmospheric pressure on Venus\'s surface is 90 times that of Earth — equivalent to being 900 metres underwater. It crushes spacecraft within hours.',
        narration: 'Carbon dioxide blankets Venus ninety kilometres deep — and that blanket traps heat so effectively that the surface would melt aluminium. Spacecraft sent to land there survive only a matter of hours before being crushed and cooked. It is a cautionary tale: what a greenhouse effect, taken to its logical extreme, looks like.',
        whatIf: 'Could the same greenhouse effect happen to Earth?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Scientists believe Venus may once have had oceans of liquid water — up to 2 billion years ago. Something went catastrophically wrong. Today, researchers are debating whether Venus still has active volcanoes. ESA\'s EnVision mission (launching 2031) aims to find out. Some scientists think Venus could be the key to understanding Earth\'s future climate.',
        narration: 'Two billion years ago, Venus may have been blue — covered in oceans, perhaps hospitable to life. Something changed. The oceans boiled away, the carbon dioxide built up, and the world became the furnace we see today. What triggered that transformation is one of the great unanswered questions in planetary science. And what it tells us about our own Earth\'s future is something we dare not ignore.',
        whatIf: 'Was Venus once as habitable as Earth?',
      },
    ],
    quizQuestion: 'Why is Venus the hottest planet?',
    quizOptions: ['It\'s closest to the Sun', 'Its thick atmosphere traps heat', 'It has active volcanoes', 'It spins very fast'],
    quizAnswer: 1,
    quizExplanation: 'Venus has a dense atmosphere of carbon dioxide that creates an extreme greenhouse effect, making it hotter than Mercury.',
  },
  {
    id: 'earth',
    name: 'Earth',
    color: '#4fa3e0',
    glowColor: '#70c8ff',
    radius: 1,
    orbitRadius: 16,
    period: 20,
    moons: 1,
    diameter: '12,742 km',
    distanceFromSun: '149.6 million km',
    orbitalPeriod: '365.25 Earth days',
    fact: 'Earth is the only planet known to support life — and the only one with liquid water on its surface.',
    description: 'Our home. Earth\'s magnetic field, liquid water, and just-right distance from the Sun make life possible.',
    texture: 'earth.jpg',
    narration: 'Earth. Our home. The only world we know of, in all the vast cosmos, where life has taken hold. Its oceans, its atmosphere, its magnetic shield — each one a miracle of circumstance. From space, it glows like a pale blue jewel in the darkness.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Earth is the only planet with liquid water on its surface, an oxygen-rich atmosphere, and plate tectonics that recycle its crust. It sits in the "Goldilocks zone" — not too hot, not too cold. If Earth were just 5% closer to the Sun, it would be like Venus. 5% further, and it would freeze solid.',
        narration: 'Five percent closer to the Sun — and Earth would be Venus. Five percent further — and it would be a frozen ball of ice. We exist in a cosmic corridor so narrow that it seems almost impossibly fortunate. Every ocean, every forest, every living thing — the product of a location almost too perfect to be accidental.',
        whatIf: 'What if Earth had no Moon?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Earth\'s magnetic field is generated by its liquid iron outer core, spinning as the planet rotates. Without it, the solar wind would strip away our atmosphere — exactly what happened to Mars. The field deflects harmful radiation and creates the auroras we see near the poles. Plate tectonics also regulate our climate by cycling carbon over millions of years.',
        narration: 'Deep inside Earth, liquid iron churns around a solid inner core — and that motion generates a magnetic field stretching sixty thousand kilometres into space. It is an invisible shield that has protected life for billions of years. Mars once had such a field. Then it died. And without it, Mars lost its atmosphere to the solar wind. We are extraordinarily lucky that ours endures.',
        whatIf: 'What would happen if Earth\'s magnetic field disappeared?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Earth is the only planet we know of with life — but the universe has 200 billion trillion stars, many with planets. Scientists are now finding Earth-like planets orbiting nearby stars. The real question scientists debate: is Earth\'s life a rare accident, or is life common throughout the cosmos? We still have no answer.',
        narration: 'Two hundred billion trillion stars are in the observable universe. Most have planets. Some of those planets sit in Goldilocks zones. And yet — in all that vastness — we have found life on exactly one: ours. Is that because life is extraordinarily rare? Or because we simply haven\'t looked far enough yet? That question may be the most important one our species ever answers.',
        whatIf: 'Are we alone in the universe?',
      },
    ],
    quizQuestion: 'What makes Earth unique in our Solar System?',
    quizOptions: ['It\'s the largest planet', 'It has the most moons', 'It has liquid water and supports life', 'It\'s closest to the Sun'],
    quizAnswer: 2,
    quizExplanation: 'Earth is the only planet known to have liquid water on its surface and to support life — as far as we know!',
  },
  {
    id: 'mars',
    name: 'Mars',
    color: '#c1440e',
    glowColor: '#e05020',
    radius: 0.53,
    orbitRadius: 22,
    period: 30,
    moons: 2,
    diameter: '6,779 km',
    distanceFromSun: '227.9 million km',
    orbitalPeriod: '687 Earth days',
    fact: 'Mars has the tallest volcano in the Solar System — Olympus Mons — three times the height of Mount Everest.',
    description: 'The Red Planet. Mars has seasons, polar ice caps, and the largest dust storms in the Solar System.',
    texture: 'mars.jpg',
    narration: 'Mars. The red planet. Named for the god of war, yet it is a world of eerie stillness — its surface scarred by the tallest volcano in the solar system, and swept by dust storms that can swallow an entire continent for months at a time.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Olympus Mons on Mars is so tall it pokes above most of the planet\'s atmosphere. It\'s 600 km wide — nearly the size of France. Mars also has the longest canyon system: Valles Marineris stretches 4,000 km, ten times longer than the Grand Canyon and deep enough to swallow Mount Everest.',
        narration: 'Olympus Mons is so immense that if you stood at its base, you could not see its peak — it would be beyond the horizon. Six hundred kilometres wide. Twenty-one kilometres tall. Three times the height of Everest. And beside it, a canyon so long it would stretch from London to New York. Mars thinks big.',
        whatIf: 'What if Mars had kept its atmosphere?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Mars lost its magnetic field around 4 billion years ago when its core cooled and stopped generating it. Without protection from the solar wind, its thick atmosphere was slowly stripped away. Today the Martian atmosphere is just 1% as dense as Earth\'s — too thin to breathe, too thin to keep water liquid, but enough to create planet-wide dust storms.',
        narration: 'Four billion years ago, Mars had a magnetic field, a thick atmosphere, and — almost certainly — liquid water. Then its core solidified and the field collapsed. The solar wind began stripping the atmosphere, molecule by molecule, over millions of years. Mars died slowly. And we can watch that same process happening today, in slow motion, from orbit.',
        whatIf: 'Could humans terraform Mars to make it habitable?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'NASA\'s Perseverance rover is collecting rock samples on Mars right now, searching for signs of ancient microbial life. Scientists have found evidence of ancient river deltas and lake beds. The big question: did life ever arise on Mars when it had liquid water? Mars Sample Return — planned for the 2030s — may finally give us the answer.',
        narration: 'Right now, at this very moment, a rover the size of a car is driving across a dried-up lake bed on Mars, drilling into rocks, looking for the chemical signatures of ancient life. Whether it finds them or not — and what that means for life in the universe — could be the most significant discovery in the history of science.',
        whatIf: 'What would we do if we found ancient life on Mars?',
      },
    ],
    quizQuestion: 'What is the tallest volcano in the Solar System?',
    quizOptions: ['Mount Everest', 'Olympus Mons', 'Mauna Kea', 'Maxwell Montes'],
    quizAnswer: 1,
    quizExplanation: 'Olympus Mons on Mars stands about 21 km high — three times taller than Mount Everest!',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: '#c88b3a',
    glowColor: '#e0a050',
    radius: 2.8,
    orbitRadius: 34,
    period: 50,
    moons: 95,
    diameter: '139,820 km',
    distanceFromSun: '778.5 million km',
    orbitalPeriod: '11.9 Earth years',
    fact: 'Jupiter is so massive that 1,300 Earths could fit inside it. Its Great Red Spot is a storm twice the size of Earth.',
    description: 'The king of planets. A gas giant with the famous Great Red Spot — a storm that has raged for over 350 years.',
    texture: 'jupiter.jpg',
    narration: 'Jupiter. The king of planets. So vast that thirteen hundred Earths could fit inside it. That great red swirl you see is a storm — a single storm — that has raged without pause for over three hundred and fifty years. Longer than any nation has existed.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Jupiter\'s Great Red Spot is a storm that has been raging for at least 350 years — and it\'s twice the size of Earth. Jupiter also acts as a cosmic shield for Earth: its massive gravity captures or deflects many asteroids and comets that would otherwise hit us. Without Jupiter, Earth might have been bombarded far more frequently.',
        narration: 'That red swirl on Jupiter\'s surface is a storm that has been raging since before the invention of the steam engine, before America existed, before modern science was born. Two Earths could fit inside it. And it shows no sign of stopping. Jupiter does not merely exist beside us — it protects us, catching the rocks of the outer solar system before they reach our world.',
        whatIf: 'What if Jupiter didn\'t exist to protect Earth?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Jupiter has no solid surface — it\'s made almost entirely of hydrogen and helium. As you descend, the pressure increases so dramatically that hydrogen is compressed into a liquid, then into a metallic state that conducts electricity. This metallic hydrogen spinning with the planet generates Jupiter\'s enormous magnetic field — 20,000 times stronger than Earth\'s.',
        narration: 'Descend into Jupiter and there is no ground to land on. The gas gradually thickens under increasing pressure until hydrogen itself becomes a liquid — and then something extraordinary: under enough pressure, hydrogen behaves like a metal, conducting electricity. That metallic hydrogen, spinning with the planet, creates a magnetic field twenty thousand times stronger than Earth\'s.',
        whatIf: 'What would happen if Jupiter became a star?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Jupiter\'s moon Europa is one of the best candidates for extraterrestrial life in our Solar System. Beneath its icy crust is a liquid water ocean — possibly twice the volume of all Earth\'s oceans — kept warm by tidal heating from Jupiter\'s gravity. NASA\'s Europa Clipper mission launched in 2024 and will arrive around 2030 to investigate.',
        narration: 'Jupiter has 95 moons. One of them — Europa — may be the most important object in the entire solar system for one question: are we alone? Beneath Europa\'s cracked, icy shell lies a liquid ocean — twice the volume of all Earth\'s oceans combined — kept warm by Jupiter\'s gravitational squeeze. NASA sent a spacecraft there in 2024. What it finds could change everything.',
        whatIf: 'Could there be life in Europa\'s underground ocean?',
      },
    ],
    quizQuestion: 'How many Earths could fit inside Jupiter?',
    quizOptions: ['About 10', 'About 100', 'About 1,300', 'About 10,000'],
    quizAnswer: 2,
    quizExplanation: 'Jupiter is so enormous that approximately 1,300 Earths could fit inside it!',
  },
  {
    id: 'saturn',
    name: 'Saturn',
    color: '#e4d191',
    glowColor: '#f0e0a0',
    radius: 2.3,
    orbitRadius: 46,
    period: 65,
    moons: 146,
    diameter: '116,460 km',
    distanceFromSun: '1.4 billion km',
    orbitalPeriod: '29.5 Earth years',
    fact: 'Saturn\'s rings stretch 282,000 km but are only about 100m thick — thinner relative to their width than a piece of paper.',
    description: 'The jewel of the Solar System. Saturn\'s beautiful rings are made of billions of chunks of ice and rock.',
    texture: 'saturn.jpg',
    rings: true,
    narration: 'Saturn. The jewel of the solar system. Those rings — stretching nearly three hundred thousand kilometres — are made not of solid material, but of billions of pieces of ice and rock, each one orbiting silently in the cold dark. Some are the size of a house. Some smaller than a grain of sand.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Saturn is so light it would float on water — it\'s the least dense planet in the Solar System. Its rings span 282,000 km but are only about 100 metres thick. That\'s like a sheet of paper 3 km wide. Saturn has 146 moons — the most of any planet — including Titan, the only moon in the Solar System with a thick atmosphere.',
        narration: 'Saturn is less dense than water. If you had an ocean large enough, it would float. Its rings stretch nearly three hundred thousand kilometres across — yet they are only about one hundred metres thick. Imagine a sheet of paper scaled up three kilometres wide. That is the rings of Saturn: breathtaking from a distance, vanishingly thin up close.',
        whatIf: 'What if Saturn\'s rings disappeared?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Saturn\'s rings are young — probably only 10 to 100 million years old (dinosaurs were still alive when they formed). They\'re slowly being pulled into Saturn by gravity and will likely disappear in about 100 million years. The rings are made of 90-95% water ice, kept bright by continuous collisions between the ring particles that expose fresh ice.',
        narration: 'Here is something that should astound you: those magnificent rings are temporary. When the dinosaurs were alive, Saturn\'s rings may not yet have existed. In another hundred million years, they will likely be gone — pulled in by gravity, piece by piece. We happen to live at exactly the right moment in cosmic time to see them at their most glorious.',
        whatIf: 'How did Saturn\'s rings form in the first place?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Saturn\'s moon Titan has rivers, lakes, and rain — but made of liquid methane, not water. It has a denser atmosphere than Earth and is the only other world with standing liquids on its surface. NASA\'s Dragonfly mission (launching 2028) will send a nuclear-powered drone helicopter to fly across Titan\'s surface and look for the chemistry of life.',
        narration: 'On Titan — Saturn\'s largest moon — it rains. Rivers cut through the landscape. Lakes shimmer in the haze. But the liquid is not water: it is methane, at minus one hundred and seventy-nine degrees. Yet Titan has all the ingredients that chemists say could, in theory, give rise to life — just not the life we know. NASA is sending a helicopter to find out.',
        whatIf: 'Could life exist in the methane lakes of Titan?',
      },
    ],
    quizQuestion: 'What are Saturn\'s rings mainly made of?',
    quizOptions: ['Gas and dust', 'Ice and rock', 'Iron and nickel', 'Water and clouds'],
    quizAnswer: 1,
    quizExplanation: 'Saturn\'s rings are made of billions of pieces of ice and rock, ranging from tiny grains to chunks as large as a house.',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    color: '#7de8e8',
    glowColor: '#a0f0f0',
    radius: 1.6,
    orbitRadius: 58,
    period: 75,
    moons: 28,
    diameter: '50,724 km',
    distanceFromSun: '2.9 billion km',
    orbitalPeriod: '84 Earth years',
    fact: 'Uranus rotates on its side — tilted at 98°. It\'s like a planet that\'s been knocked over and rolls around the Sun.',
    description: 'The sideways planet. Uranus rotates on its side, possibly due to a collision with an Earth-sized object long ago.',
    texture: 'uranus.jpg',
    narration: 'Uranus. The sideways planet. Long ago, something enormous struck it — and knocked it clean onto its side. It has orbited the Sun tilted ever since, like a rolling ball, its poles experiencing decades of unbroken daylight followed by decades of total darkness.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Uranus is tilted 98° — so it essentially rolls around the Sun on its side. Each pole gets 42 years of continuous sunlight, then 42 years of darkness. Uranus is also the coldest planet (−224°C), even though Neptune is farther from the Sun. It radiates almost no heat from its interior — scientists don\'t know why.',
        narration: 'For forty-two years, one pole of Uranus faces the Sun without a single night. Then for forty-two years, total darkness. An entire human lifetime of unbroken daylight, followed by an entire lifetime of perpetual night. And despite being an ice giant, Uranus is colder even than Neptune — a mystery that science has not yet explained.',
        whatIf: 'What would seasons be like if Earth was tilted like Uranus?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Uranus is an "ice giant" — unlike Jupiter and Saturn which are gas giants. Its interior is made of a hot, dense fluid of water, methane, and ammonia ices (not solid ice). The methane in its atmosphere absorbs red light and reflects blue-green light, giving it its distinctive teal colour. Its magnetic field is bizarre — tilted 60° from its rotation axis and not centred on the planet.',
        narration: 'Uranus and Neptune are a different breed from Jupiter and Saturn. Instead of mostly hydrogen and helium, their interiors are a slushy mix of water, ammonia, and methane under crushing pressure — hot enough to be fluid, dense enough to be called ice. And Uranus\'s magnetic field is one of the strangest in the solar system — tilted, off-centre, and asymmetric in ways we do not yet understand.',
        whatIf: 'What created Uranus\'s extreme tilt?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Uranus is the least-explored outer planet — only one spacecraft (Voyager 2, in 1986) has ever visited it. Scientists have proposed a Uranus orbiter mission, and in 2022 the National Academies of Sciences ranked it as the top priority for planetary science in the next decade. We know remarkably little about this planet. Its 28 moons may have subsurface oceans.',
        narration: 'Of all the planets, Uranus is the most mysterious — because we have barely looked at it. One spacecraft flew past in 1986, spending just a few hours nearby. In the nearly forty years since, no mission has returned. Scientists have now ranked a dedicated Uranus orbiter as the most important planetary mission of the coming decade. What we find there may rewrite what we know about ice giants — which, it turns out, may be the most common type of planet in the galaxy.',
        whatIf: 'What might we discover on Uranus\'s moons?',
      },
    ],
    quizQuestion: 'What is unusual about the way Uranus rotates?',
    quizOptions: ['It doesn\'t rotate', 'It rotates on its side (98° tilt)', 'It rotates backwards', 'It rotates extremely fast'],
    quizAnswer: 1,
    quizExplanation: 'Uranus is tilted 98° on its axis, so it essentially rolls around the Sun on its side — making its seasons very extreme.',
  },
  {
    id: 'neptune',
    name: 'Neptune',
    color: '#4b70dd',
    glowColor: '#6090ff',
    radius: 1.5,
    orbitRadius: 70,
    period: 85,
    moons: 16,
    diameter: '49,244 km',
    distanceFromSun: '4.5 billion km',
    orbitalPeriod: '165 Earth years',
    fact: 'Neptune has the strongest winds in the Solar System — reaching 2,100 km/h, faster than the speed of sound on Earth.',
    description: 'The farthest planet. Neptune is so remote that it takes light from the Sun over 4 hours to reach it.',
    texture: 'neptune.jpg',
    narration: 'Neptune. The farthest world. So distant that light from the Sun takes over four hours to reach it. Here, winds howl at two thousand kilometres an hour — the fastest in the solar system. It is a place of perpetual storm, and perpetual darkness.',
    layers: [
      {
        label: 'Wonder', emoji: '🌟',
        text: 'Neptune has never completed a full orbit since it was discovered in 1846 — one Neptune year is 165 Earth years. Its winds reach 2,100 km/h — supersonic by Earth standards. It generates more heat than it receives from the Sun: something in its interior is still radiating leftover energy from its formation billions of years ago.',
        narration: 'Neptune was discovered in 1846. It has not yet completed a single orbit of the Sun since then — one Neptune year lasts a hundred and sixty-five of ours. Its winds are the fastest in the solar system — faster than the speed of sound on Earth. And it glows with heat from its own interior, still cooling from the violence of its birth billions of years ago.',
        whatIf: 'What lies beyond Neptune at the edge of the Solar System?',
      },
      {
        label: 'Explorer', emoji: '🔭',
        text: 'Neptune was the only planet found by mathematics before being seen through a telescope. Astronomers noticed Uranus wasn\'t orbiting exactly as predicted, so they calculated where an unknown planet must be — and found Neptune precisely where the maths said it would be. It was a triumph of Newton\'s laws of gravity.',
        narration: 'Neptune was not discovered by chance — it was discovered by mathematics. Astronomers noticed that Uranus was wobbling slightly from its predicted path, as if something unseen was pulling at it. They calculated where that something must be. They pointed a telescope at that spot in the sky. And there it was: a new world, exactly where Newton\'s equations said it should be. Mathematics had found a planet.',
        whatIf: 'How did scientists predict where Neptune would be before seeing it?',
      },
      {
        label: 'Deep Space', emoji: '🌌',
        text: 'Neptune\'s moon Triton orbits backwards — the wrong way — suggesting it was captured from the Kuiper Belt rather than forming with Neptune. Triton has geysers of nitrogen ice erupting from its surface. It\'s slowly spiralling inward and will be torn apart by Neptune\'s gravity in about 3.6 billion years, potentially forming new rings. Beyond Neptune lies the Kuiper Belt and the distant Oort Cloud.',
        narration: 'Neptune\'s largest moon, Triton, orbits in the wrong direction — backwards, against the spin of every other major moon in the solar system. It was captured, billions of years ago, from the frozen wilderness beyond Neptune. On its surface, geysers of liquid nitrogen erupt into space. And one day — three and a half billion years from now — Neptune\'s gravity will tear it apart entirely. The rubble will become rings. And Neptune will briefly rival Saturn.',
        whatIf: 'What is it like in the Kuiper Belt beyond Neptune?',
      },
    ],
    quizQuestion: 'What is Neptune known for?',
    quizOptions: ['Being the hottest planet', 'Having the strongest winds in the Solar System', 'Being closest to Earth', 'Having no moons'],
    quizAnswer: 1,
    quizExplanation: 'Neptune has the most violent weather of any planet — winds can reach 2,100 km/h!',
  },
]

// ---------------------------------------------------------------------------
// Wonder type per planet — drives the WonderOverlay animation
// ---------------------------------------------------------------------------
const PLANET_WONDER_TYPES: Record<string, WonderType> = {
  mercury: 'temperature',
  venus:   'temperature',
  earth:   'speed-of-light',
  mars:    'size-comparison',
  jupiter: 'jupiter-size',
  saturn:  'saturn-rings',
  uranus:  'gravity',
  neptune: 'gravity',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SolarSystemProps {
  onAskDecifer?: (context: string) => void
  onExplore?: (topicKey: string) => void
}

// ---------------------------------------------------------------------------
// Sun
// ---------------------------------------------------------------------------

function Sun() {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const texture = useLoader(TextureLoader, '/textures/sun.jpg')

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.getElapsedTime() * 0.05
    if (glowRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 1.5) * 0.02
      glowRef.current.scale.setScalar(s)
    }
  })

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[4.2, 32, 32]} />
        <meshBasicMaterial color="#ff9900" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5.5, 32, 32]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.03} side={THREE.BackSide} />
      </mesh>
      <pointLight intensity={2} distance={200} decay={1} color="#fff5e0" />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Orbit ring
// ---------------------------------------------------------------------------

function OrbitRing({ radius }: { radius: number }) {
  const lineObj = useRef<THREE.Line | null>(null)
  if (!lineObj.current) {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06 })
    lineObj.current = new THREE.Line(geo, mat)
  }
  // Dispose geometry + material when component unmounts
  useEffect(() => {
    const obj = lineObj.current
    return () => {
      obj?.geometry.dispose()
      ;(obj?.material as THREE.Material | undefined)?.dispose()
    }
  }, [])
  return <primitive object={lineObj.current} />
}

// ---------------------------------------------------------------------------
// Saturn rings
// ---------------------------------------------------------------------------

function SaturnRings() {
  const texture = useLoader(TextureLoader, '/textures/saturn-rings.png')
  return (
    <Ring args={[2.8, 5.2, 128]}>
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent opacity={0.9} />
    </Ring>
  )
}

// ---------------------------------------------------------------------------
// Planet mesh
// ---------------------------------------------------------------------------

interface PlanetMeshProps {
  planet: Planet
  paused: boolean
  isSelected: boolean
  onSelect: (planet: Planet) => void
  onFirstVisit: (id: string) => void
  visitedRef: React.MutableRefObject<Set<string>>
  initialAngle: number
}

function PlanetMesh({ planet, paused, isSelected, onSelect, onFirstVisit, visitedRef, initialAngle }: PlanetMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const angleRef = useRef(initialAngle)
  const texture = useLoader(TextureLoader, `/textures/${planet.texture}`)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (!paused) angleRef.current += (delta / planet.period) * Math.PI * 2
    groupRef.current.position.x = Math.cos(angleRef.current) * planet.orbitRadius
    groupRef.current.position.z = Math.sin(angleRef.current) * planet.orbitRadius
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.3
  })

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(planet)
    if (!visitedRef.current.has(planet.id)) {
      visitedRef.current.add(planet.id)
      onFirstVisit(planet.id)
    }
  }, [planet, onSelect, onFirstVisit, visitedRef])

  return (
    <group ref={groupRef}>
      {/* Glow */}
      <mesh scale={isSelected ? 1.5 : 1.2}>
        <sphereGeometry args={[planet.radius, 16, 16]} />
        <meshBasicMaterial color={planet.glowColor} transparent opacity={isSelected ? 0.3 : 0.08} side={THREE.BackSide} />
      </mesh>
      {/* Body */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[planet.radius, 32, 32]} />
        <meshStandardMaterial map={texture} roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Saturn rings */}
      {planet.rings && (
        <group rotation={[Math.PI / 6, 0, 0]}>
          <SaturnRings />
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Stable initial angles — computed once, never random per render
// ---------------------------------------------------------------------------
const INITIAL_ANGLES = PLANETS.map((_, i) => (i / PLANETS.length) * Math.PI * 2)

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

interface SceneProps {
  paused: boolean
  selected: Planet | null
  onSelect: (planet: Planet | null) => void
  onFirstVisit: (id: string) => void
  visitedRef: React.MutableRefObject<Set<string>>
}

function Scene({ paused, selected, onSelect, onFirstVisit, visitedRef }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <Stars radius={150} depth={60} count={3000} factor={4} saturation={0.3} fade speed={0.5} />
      <Sun />
      {PLANETS.map((planet, i) => (
        <group key={planet.id}>
          <OrbitRing radius={planet.orbitRadius} />
          <PlanetMesh
            planet={planet}
            paused={paused}
            isSelected={selected?.id === planet.id}
            onSelect={onSelect}
            onFirstVisit={onFirstVisit}
            visitedRef={visitedRef}
            initialAngle={INITIAL_ANGLES[i]}
          />
        </group>
      ))}
      {/* Invisible backdrop to deselect on background click */}
      <mesh onClick={() => onSelect(null)} visible={false}>
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// Camera controller
// ---------------------------------------------------------------------------

function CameraController({ selected, zoom }: { selected: Planet | null; zoom: number }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(0, 30, 80))
  const currentPos = useRef(new THREE.Vector3(0, 30, 80))

  useFrame((_, delta) => {
    if (selected) {
      targetPos.current.set(
        selected.orbitRadius * 0.5,
        selected.orbitRadius * 0.35,
        selected.orbitRadius * 1.1,
      )
    } else {
      // Apply zoom: zoom > 1 = zoomed in (camera closer), zoom < 1 = zoomed out
      const z = 80 / zoom
      const y = 30 / zoom
      targetPos.current.set(0, y, z)
    }
    currentPos.current.lerp(targetPos.current, delta * 1.5)
    camera.position.copy(currentPos.current)
    camera.lookAt(0, 0, 0)
  })

  return null
}

// ---------------------------------------------------------------------------
// Quiz panel
// ---------------------------------------------------------------------------

function QuizPanel({ planet }: { planet: Planet }) {
  const [chosen, setChosen] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white/90">{planet.quizQuestion}</p>
      <div className="space-y-2">
        {planet.quizOptions.map((opt, i) => {
          const answered = chosen !== null
          const isCorrect = i === planet.quizAnswer
          const isChosen = i === chosen
          let bg = 'rgba(255,255,255,0.08)'
          if (answered && isCorrect) bg = 'rgba(64,192,87,0.3)'
          else if (answered && isChosen && !isCorrect) bg = 'rgba(255,107,107,0.3)'
          return (
            <button
              key={i}
              onClick={() => !answered && setChosen(i)}
              className="block w-full text-left rounded-xl px-3 py-2 text-sm text-white transition-all"
              style={{
                background: bg,
                border: answered && isCorrect ? '1px solid rgba(64,192,87,0.5)' : '1px solid transparent',
                minHeight: '48px',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {chosen !== null && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-white/70 leading-relaxed"
        >
          {chosen === planet.quizAnswer ? '✅ ' : '❌ '}{planet.quizExplanation}
        </motion.p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info panel
// ---------------------------------------------------------------------------

interface InfoPanelProps {
  planet: Planet
  onClose: () => void
  onAskDecifer?: (context: string) => void
  onOpenWonder?: (type: WonderType, name: string) => void
  muted: boolean
  onToggleMute: () => void
}

const LAYER_COLORS = [
  { bg: 'rgba(255,215,0,0.12)', border: 'rgba(255,215,0,0.25)', text: '#ffd700', active: 'linear-gradient(135deg, #ffd700, #ffaa00)' },
  { bg: 'rgba(108,158,255,0.12)', border: 'rgba(108,158,255,0.25)', text: '#6C9EFF', active: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' },
  { bg: 'rgba(82,217,160,0.12)', border: 'rgba(82,217,160,0.25)', text: '#52D9A0', active: 'linear-gradient(135deg, #52D9A0, #00b4d8)' },
]

function InfoPanel({ planet, onClose, onAskDecifer, onOpenWonder, muted, onToggleMute }: InfoPanelProps) {
  const [tab, setTab] = useState<'discover' | 'quiz'>('discover')
  const [activeLayer, setActiveLayer] = useState(0)
  const [showNudge, setShowNudge] = useState(false)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wonderType = PLANET_WONDER_TYPES[planet.id]

  // Reset state when planet changes
  useEffect(() => {
    setTab('discover')
    setActiveLayer(0)
    setShowNudge(false)
  }, [planet.id])

  // "Go deeper?" nudge after 5s on layer 0
  useEffect(() => {
    if (tab !== 'discover' || activeLayer !== 0) { setShowNudge(false); return }
    nudgeTimer.current = setTimeout(() => setShowNudge(true), 5000)
    return () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current) }
  }, [planet.id, tab, activeLayer])

  const handleLayerChange = (i: number) => {
    setActiveLayer(i)
    setShowNudge(false)
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
  }

  const layer = planet.layers[Math.min(activeLayer, planet.layers.length - 1)]
  const lc = LAYER_COLORS[Math.min(activeLayer, LAYER_COLORS.length - 1)]

  return (
    <motion.div
      key={planet.id}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto"
      style={{
        maxHeight: '50vh',
        background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-3"
        style={{ background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex-none"
            style={{ background: `radial-gradient(circle at 35% 35%, ${planet.glowColor}, ${planet.color})` }}
          />
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{planet.name}</h2>
            <p className="text-xs text-white/40">{planet.moons} moon{planet.moons !== 1 ? 's' : ''} · {planet.diameter}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NarrationButton
            text={tab === 'discover' ? layer.narration : planet.narration}
            muted={muted}
            onToggleMute={onToggleMute}
            autoPlay
          />
          <button
            onClick={onClose}
            className="flex-none rounded-full flex items-center justify-center text-white/50"
            style={{ background: 'rgba(255,255,255,0.1)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Top-level tabs: Discover / Quiz */}
      <div className="flex gap-2 px-5 mb-4">
        {(['discover', 'quiz'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 rounded-full text-xs font-semibold transition-all"
            style={{
              background: tab === t ? 'linear-gradient(135deg, #6C9EFF, #a78bfa)' : 'rgba(255,255,255,0.08)',
              color: 'white',
              minHeight: '48px',
            }}
          >
            {t === 'discover' ? '🔍 Discover' : '🧪 Quiz'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="px-5 pb-6 space-y-4">
        {tab === 'discover' ? (
          <>
            {/* Layer depth chips */}
            <div className="flex gap-2">
              {planet.layers.map((l, i) => (
                <button
                  key={l.label}
                  onClick={() => handleLayerChange(i)}
                  className="flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: activeLayer === i ? LAYER_COLORS[i].active : 'rgba(255,255,255,0.08)',
                    color: 'white',
                    minHeight: '48px',
                    border: activeLayer === i ? 'none' : `1px solid ${LAYER_COLORS[i].border}`,
                  }}
                >
                  <span>{l.emoji}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>

            {/* Layer content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeLayer}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl p-4"
                style={{ background: lc.bg, border: `1px solid ${lc.border}` }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: lc.text }}>
                  {layer.emoji} {layer.label}
                </p>
                <p className="text-sm text-white/90 leading-relaxed">{layer.text}</p>
              </motion.div>
            </AnimatePresence>

            {/* Wonder moment button — only on Wonder layer */}
            {activeLayer === 0 && wonderType && (
              <button
                onClick={() => onOpenWonder?.(wonderType, planet.name)}
                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', minHeight: '48px' }}
              >
                {WONDER_LABELS[wonderType]}
              </button>
            )}

            {/* "Go deeper?" nudge */}
            <AnimatePresence>
              {showNudge && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleLayerChange(1)}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95"
                  style={{
                    background: 'rgba(108,158,255,0.15)',
                    border: '1px solid rgba(108,158,255,0.3)',
                    minHeight: '48px',
                  }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >🔭</motion.span>
                  Go deeper — Explorer view
                </motion.button>
              )}
            </AnimatePresence>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Distance from Sun', value: planet.distanceFromSun },
                { label: 'Year length', value: planet.orbitalPeriod },
                { label: 'Diameter', value: planet.diameter },
                { label: 'Moons', value: String(planet.moons) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* What if — pre-fills Ask Decifer */}
            <button
              onClick={() => onAskDecifer?.(layer.whatIf)}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: '48px' }}
            >
              <span>💭</span> {layer.whatIf}
            </button>
          </>
        ) : (
          <QuizPanel planet={planet} />
        )}
      </div>

    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Journey panel
// ---------------------------------------------------------------------------

interface JourneyPanelProps {
  planet: Planet
  step: number
  total: number
  muted: boolean
  onToggleMute: () => void
  onNext: () => void
  onStayHere: () => void
  onFinish: () => void
}

function JourneyPanel({ planet, step, total, muted, onToggleMute, onNext, onStayHere, onFinish }: JourneyPanelProps) {
  const isLast = step === total - 1
  const layer = planet.layers[0]

  return (
    <motion.div
      key={planet.id}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl"
      style={{
        maxHeight: '44vh',
        background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-3 pb-1">
        {Array.from({ length: total }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: i === step ? 1.4 : 1, opacity: i <= step ? 1 : 0.3 }}
            className="rounded-full"
            style={{
              width: i === step ? 10 : 7,
              height: i === step ? 10 : 7,
              background: i === step ? planet.glowColor : '#ffffff',
            }}
          />
        ))}
      </div>

      {/* Planet header */}
      <div className="flex items-center gap-3 px-5 pt-2 pb-1">
        <div
          className="h-10 w-10 rounded-full flex-none"
          style={{ background: `radial-gradient(circle at 35% 35%, ${planet.glowColor}, ${planet.color})` }}
        />
        <div className="flex-1">
          <p className="text-[10px] text-white/40 uppercase tracking-widest">World {step + 1} of {total}</p>
          <h2 className="text-lg font-bold text-white leading-tight">{planet.name}</h2>
        </div>
        <NarrationButton text={layer.narration} muted={muted} onToggleMute={onToggleMute} autoPlay />
      </div>

      {/* Wonder fact */}
      <div className="mx-5 mt-1.5 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}>
        <p className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider mb-1">🌟 Wonder</p>
        <p className="text-xs text-white/90 leading-relaxed">{layer.text}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-5 mt-3">
        <button
          onClick={onStayHere}
          className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px' }}
        >
          Stay here
        </button>
        <button
          onClick={isLast ? onFinish : onNext}
          className="flex-[2] rounded-2xl px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-95"
          style={{ background: isLast ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : 'linear-gradient(135deg, #6C9EFF, #a78bfa)', minHeight: '48px' }}
        >
          {isLast ? '🏆 Complete Journey' : <>Next world <span>→</span></>}
        </button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Journey complete overlay
// ---------------------------------------------------------------------------

function JourneyComplete({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,8,0.85)' }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="w-full max-w-sm rounded-3xl p-8 text-center"
        style={{ background: 'linear-gradient(160deg, #1a1a3e, #0d0d20)', border: '2px solid rgba(255,215,0,0.4)' }}
      >
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          className="text-6xl mb-4"
        >🏆</motion.div>
        <h2 className="text-2xl font-extrabold text-white mb-2">Solar System Explorer!</h2>
        <p className="text-sm text-white/60 mb-2">You visited all 8 worlds of our Solar System.</p>
        <p className="text-sm font-bold text-yellow-300 mb-6">+200 points earned</p>
        <button
          onClick={onDismiss}
          className="w-full rounded-2xl py-3 text-sm font-bold text-black active:scale-95"
          style={{ background: 'linear-gradient(135deg, #ffd700, #ffaa00)', minHeight: '48px' }}
        >
          Explore freely
        </button>
      </motion.div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SolarSystem({ onAskDecifer, onExplore }: SolarSystemProps) {
  const [selected, setSelected] = useState<Planet | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const [journeyStep, setJourneyStep] = useState<number | null>(null)
  const [journeyDone, setJourneyDone] = useState(false)
  const [wonder, setWonder] = useState<{ type: WonderType; planetName: string } | null>(null)
  const visitedRef = useRef<Set<string>>(new Set())

  const zoomIn  = useCallback(() => setZoom(z => Math.min(3, parseFloat((z * 1.4).toFixed(2)))), [])
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.35, parseFloat((z / 1.4).toFixed(2)))), [])

  const journeyActive = journeyStep !== null

  // When journey is active, camera is driven by the current journey planet
  const displaySelected = journeyActive ? PLANETS[journeyStep] : selected

  const handleSelect = useCallback((planet: Planet | null) => {
    if (journeyActive) {
      // Tapping a planet during journey exits journey and selects that planet freely
      if (planet) {
        stopNarration()
        setJourneyStep(null)
        setSelected(planet)
      }
      return
    }
    setSelected(planet)
    setPaused(planet !== null)
  }, [journeyActive])

  // Cards are queued and shown after the panel closes, not mid-exploration
  const pendingCardRef = useRef<DroppedCard | null>(null)

  const handleFirstVisit = useCallback(async (id: string) => {
    onExplore?.(id)
    try {
      const res = await fetch('/api/explore/card-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'solar-system', topicKey: id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.card) pendingCardRef.current = data.card
      }
    } catch {
      // card drop failure is non-fatal
    }
  }, [onExplore])

  const handleClose = useCallback(() => {
    setSelected(null)
    setPaused(false)
    stopNarration()
    // Show any queued card now that the panel is gone
    if (pendingCardRef.current) {
      const card = pendingCardRef.current
      pendingCardRef.current = null
      setTimeout(() => setRevealCard(card), 350)
    }
  }, [])

  const handleAskDecifer = useCallback((context: string) => {
    setSelected(null)
    setPaused(false)
    stopNarration()
    onAskDecifer?.(context)
  }, [onAskDecifer])

  const startJourney = useCallback(() => {
    stopNarration()
    setSelected(null)
    setJourneyStep(0)
    setPaused(true)
  }, [])

  const journeyNext = useCallback(() => {
    stopNarration()
    setJourneyStep(s => (s !== null && s < PLANETS.length - 1 ? s + 1 : s))
  }, [])

  const journeyStayHere = useCallback(() => {
    stopNarration()
    setJourneyStep(prev => {
      const planet = prev !== null ? PLANETS[prev] : null
      setSelected(planet)
      return null
    })
  }, [])

  const journeyFinish = useCallback(async () => {
    stopNarration()
    setJourneyStep(null)
    setTimeout(() => setJourneyDone(true), 350) // wait for JourneyPanel exit animation
    try {
      await fetch('/api/explore/journey-complete', { method: 'POST' })
    } catch {
      // non-fatal
    }
  }, [])

  // Mark journey planets as visited for card-drop dedup
  useEffect(() => {
    if (journeyStep === null) return
    const planet = PLANETS[journeyStep]
    if (!visitedRef.current.has(planet.id)) {
      visitedRef.current.add(planet.id)
      handleFirstVisit(planet.id)
    }
  }, [journeyStep, handleFirstVisit])

  // Stop narration on unmount
  useEffect(() => () => {
    document.body.style.cursor = 'auto'
    stopNarration()
  }, [])

  return (
    <div className="fixed inset-0" style={{ background: '#000008' }}>
      {/* Pause / resume (hidden during journey) */}
      {!journeyActive && (
        <button
          onClick={() => setPaused(p => !p)}
          className="absolute top-4 right-4 z-30 rounded-full flex items-center justify-center text-sm text-white"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? '▶' : '⏸'}
        </button>
      )}

      {/* Zoom controls — visible when no panel is open */}
      {!selected && !journeyActive && (
        <div className="absolute right-4 z-30 flex flex-col gap-2" style={{ top: '72px' }}>
          <button
            onClick={zoomIn}
            disabled={zoom >= 3}
            className="rounded-full flex items-center justify-center text-lg font-bold text-white transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.35}
            className="rounded-full flex items-center justify-center text-lg font-bold text-white transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', minHeight: '48px', minWidth: '48px' }}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      )}

      {/* 3D canvas */}
      <Canvas
        camera={{ position: [0, 30, 80], fov: 55, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene
            paused={paused}
            selected={displaySelected}
            onSelect={handleSelect}
            onFirstVisit={handleFirstVisit}
            visitedRef={visitedRef}
          />
          <CameraController selected={displaySelected} zoom={zoom} />
        </Suspense>
      </Canvas>

      {/* Bottom hint + Take the Journey button */}
      {!journeyActive && !selected && (
        <div className="absolute bottom-6 inset-x-0 z-20 flex flex-col items-center gap-3">
          <button
            onClick={startJourney}
            className="rounded-full px-6 text-sm font-bold text-white flex items-center gap-2 active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)',
              border: '1px solid rgba(108,158,255,0.4)',
              minHeight: '48px',
            }}
          >
            🚀 Take the Journey
          </button>
          <p className="text-[11px] text-white/20">or tap any planet to explore</p>
        </div>
      )}

      {/* Free-explore info panel + backdrop */}
      <AnimatePresence>
        {selected && !journeyActive && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={handleClose}
            />
            <InfoPanel
              planet={selected}
              onClose={handleClose}
              onAskDecifer={handleAskDecifer}
              onOpenWonder={(type, name) => setWonder({ type, planetName: name })}
              muted={muted}
              onToggleMute={() => setMuted(m => !m)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Journey panel */}
      <AnimatePresence>
        {journeyActive && (
          <JourneyPanel
            planet={PLANETS[journeyStep]}
            step={journeyStep}
            total={PLANETS.length}
            muted={muted}
            onToggleMute={() => setMuted(m => !m)}
            onNext={journeyNext}
            onStayHere={journeyStayHere}
            onFinish={journeyFinish}
          />
        )}
      </AnimatePresence>

      {/* Journey complete overlay */}
      <AnimatePresence>
        {journeyDone && (
          <JourneyComplete onDismiss={() => { setJourneyDone(false); setPaused(false) }} />
        )}
      </AnimatePresence>

      {/* Wonder overlay — rendered at root level to avoid stacking context issues */}
      <AnimatePresence>
        {wonder && (
          <WonderOverlay
            type={wonder.type}
            planetName={wonder.planetName}
            onClose={() => setWonder(null)}
          />
        )}
      </AnimatePresence>

      {/* Card reveal — fires on first visit to each planet */}
      {revealCard && (
        <CardReveal
          card={revealCard}
          onDismiss={() => setRevealCard(null)}
        />
      )}
    </div>
  )
}
