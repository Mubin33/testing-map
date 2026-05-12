# 🗺️ GeoPlanner

**Map Measurement & Equipment Layout Tool** — built with Next.js 14, TypeScript, Tailwind CSS, and Google Maps.

---

## Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Full Google Map** | Dark-themed satellite/map with smooth controls |
| 📏 **Measure Distance** | Click points to measure multi-segment paths with live labels |
| 📐 **Area Selection** | Draw resizable rectangles on map; area auto-calculated |
| 📦 **Equipment Library** | 8 preset items (containers, vehicles, tents, racks, pallets) |
| ➕ **Custom Equipment** | Add any item with name, emoji, length & width |
| 🖱️ **Drag & Drop** | Drag equipment cards into the Fit Calculator |
| 🔢 **Fit Calculator** | Auto-calculates rows × cols, total units, efficiency % |
| 🔄 **Auto-rotation** | Tries both orientations, picks best fit automatically |
| 📊 **Visual Grid** | Live preview grid of layout inside selected area |
| ↔️ **Collapsible Panels** | Both sidebars collapse for full-screen map |
| ⌨️ **Keyboard Shortcuts** | P = Pan, M = Measure, A = Area, Esc = Cancel |
| 📏 **Unit Toggle** | Switch between meters and feet |
| 💾 **Manual Area Input** | Enter area dimensions manually (no map needed) |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
# or
yarn install
```

### 2. Set up Google Maps API Key

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

#### How to get a Google Maps API Key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Drawing Library** (part of Maps JS API)
   - **Geometry Library** (part of Maps JS API)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. (Optional) Restrict the key to your domain for production

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## File Structure

```
geo-planner/
├── src/
│   ├── app/
│   │   ├── globals.css          # Fonts, CSS variables, base styles
│   │   ├── layout.tsx           # HTML root layout
│   │   └── page.tsx             # Main app (DnD context, state orchestration)
│   ├── components/
│   │   ├── Map/
│   │   │   └── MapContainer.tsx # Google Maps + drawing + measure overlays
│   │   ├── Equipment/
│   │   │   ├── EquipmentCard.tsx       # Draggable equipment card
│   │   │   ├── EquipmentPanel.tsx      # Left sidebar list + add form
│   │   │   └── EquipmentCalculator.tsx # Right sidebar calculator + grid
│   │   └── UI/
│   │       ├── Sidebar.tsx      # Collapsible sidebar wrapper
│   │       └── Toolbar.tsx      # Floating top tool switcher
│   ├── hooks/
│   │   ├── useMeasure.ts        # Measure points + distance state
│   │   └── useEquipment.ts      # Equipment CRUD + selection
│   ├── types/
│   │   └── index.ts             # All TypeScript interfaces
│   └── utils/
│       ├── geoUtils.ts          # Haversine, area math, formatting
│       └── geometryUtils.ts     # Fit calculation + grid preview
├── .env.local.example
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## How to Use

### Measure Distance
1. Press **M** or click the Ruler tool
2. Click points on the map
3. Each segment shows its distance; total shown in toolbar and at last point
4. Press **Esc** or use the ↺ button to clear

### Select Area
1. Press **A** or click the Square tool
2. Click and drag a rectangle on the map
3. The area dimensions are shown on the map and in the calculator

### Calculate Equipment Fit
1. Select or draw an area on the map (or enter manual dimensions)
2. Click any equipment item in the left sidebar, or drag it to the calculator
3. Adjust **Spacing** slider
4. The calculator shows: total fit, rows × columns, coverage %, and a visual grid

### Add Custom Equipment
1. Click **+ Custom** in the Equipment panel header
2. Choose an emoji, enter name, length, and width
3. Click **Add Equipment**

---

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **@react-google-maps/api** — Google Maps integration
- **@dnd-kit/core** — Drag and drop
- **lucide-react** — Icons
- **Exo 2** + **JetBrains Mono** — Typography

---

## Production Build

```bash
npm run build
npm start
```

> ⚠️ Make sure to set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in your production environment variables.
