# Lottery Theme - Complete Node Hierarchy Report

**Generated:** 2026-01-14  
**Root Node:** `1278:9628` - "Lottery: Hourly Draw"  
**Type:** GROUP  
**Dimensions:** 4399 × 1537 px

---

## Overview

This document provides a complete hierarchical breakdown of the "Lottery: Hourly Draw" design system in Figma. The design consists of **4 main states/screens**:

1. **Active** - Main lottery screen with countdown and ticket displays
2. **Draw** - The draw animation/result screen
3. **Win** - Winner celebration screen
4. **Fail** - "No win this time" screen

---

## Complete Node Tree

### 📁 Lottery: Hourly Draw (GROUP) `1278:9628`

├── **Dimensions:** 4399 × 1537 px
├── **Position:** x: -898, y: -3021

---

### 📁 1. active (GROUP) `1260:33085`

├── **Dimensions:** 1024 × 1537 px
│
├── 🔷 **background - default** (INSTANCE) `1278:9393`
│ ├── Component: `background - default`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ └── 📁 **visuals** (FRAME) `I1278:9393;1278:9292`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ ├── ▢ **background - active** (RECTANGLE) `I1278:9393;1278:9293`
│ │ ├── Fill: IMAGE (imageHash: 97879163...)
│ │ └── **Dimensions:** 1024 × 1536 px
│ │
│ ├── 📝 **title** (TEXT) `I1278:9393;1278:9321`
│ │ ├── Content: "Grand Prize Pool"
│ │ ├── Font: Lato Regular, 64px
│ │ ├── Color: White (#FFFFFF)
│ │ └── Effect: Drop Shadow (4px blur)
│ │
│ └── 📝 **subtext** (TEXT) `I1278:9393;1278:9322`
│ ├── Content: "Keep playing to earn tickets for the next draw! Golden tickets roll over!"
│ ├── Font: Lato Black, 32px
│ ├── Color: Golden (#FEF0A4)
│ └── Effect: Drop Shadow (4px blur)
│
├── 🔷 **countdown** (INSTANCE) `1278:9368`
│ ├── Component: `countdown`
│ ├── **Dimensions:** 738 × 385 px
│ │
│ ├── 📁 **background** (GROUP) `I1278:9368;1278:9341`
│ │ │
│ │ ├── ▢ **frame - wide** (RECTANGLE) `I1278:9368;1278:9343`
│ │ │ ├── Fill: IMAGE (imageHash: 6b00a575...)
│ │ │ └── **Dimensions:** 738 × 369 px
│ │ │
│ │ └── 📁 **top** (GROUP) `I1278:9368;1278:9344`
│ │ │
│ │ ├── ▢ **frame - round small** (RECTANGLE) `I1278:9368;1278:9345`
│ │ │ ├── Fill: IMAGE (imageHash: b2d59f68...)
│ │ │ └── **Dimensions:** 288 × 80 px
│ │ │
│ │ └── 📝 **NEXT DRAW IN** (TEXT) `I1278:9368;1278:9346`
│ │ ├── Content: "NEXT DRAW IN"
│ │ ├── Font: Lato Bold, 24px
│ │ └── Color: Golden (#FDF98F)
│ │
│ └── 📁 **digits** (FRAME) `I1278:9368;1278:9347`
│ ├── Layout: HORIZONTAL, spacing: 8px
│ ├── **Dimensions:** 536 × 90 px
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9348`
│ │ ├── Component: `numbers`
│ │ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9349`
│ │ ├── Component: `numbers`
│ │ └── ▢ **09_9** (RECTANGLE) - Digit "9"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9350`
│ │ ├── Component: `numbers`
│ │ └── ▢ **10_colon** (RECTANGLE) - Colon ":"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9351`
│ │ ├── Component: `numbers`
│ │ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9352`
│ │ ├── Component: `numbers`
│ │ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9353`
│ │ ├── Component: `numbers`
│ │ └── ▢ **10_colon** (RECTANGLE) - Colon ":"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9354`
│ │ ├── Component: `numbers`
│ │ └── ▢ **02_2** (RECTANGLE) - Digit "2"
│ │
│ └── 🔷 **numbers** (INSTANCE) `I1278:9368;1278:9355`
│ ├── Component: `numbers`
│ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│
├── 🔷 **button** (INSTANCE) `1265:6992`
│ ├── Component: `button`
│ ├── **Dimensions:** 310 × 120 px
│ ├── Fill: Gradient (Cyan to Teal)
│ ├── Stroke: #9FFFF8, 2px
│ ├── Corner Radius: 50px
│ ├── Effect: Drop Shadow (Cyan glow)
│ ├── Layout: HORIZONTAL, padding: 40px/20px
│ │
│ └── 📝 **DEFAULT** (TEXT) `I1265:6992;1265:6977`
│ ├── Content: "DEFAULT"
│ ├── Font: Lato Black, 42px
│ ├── Color: White (#FFFFFF)
│ └── Effect: Drop Shadow
│
├── 🔷 **tickets - normal** (INSTANCE) `1278:9424`
│ ├── Component: `tickets - normal`
│ ├── **Dimensions:** 430 × 475 px
│ │
│ ├── 📁 **background** (GROUP) `I1278:9424;1278:9401`
│ │ │
│ │ ├── ▢ **frame** (RECTANGLE) `I1278:9424;1278:9402`
│ │ │ ├── Fill: IMAGE (imageHash: d25fd6a5...)
│ │ │ └── **Dimensions:** 430 × 475 px
│ │ │
│ │ └── ▢ **ticket - normal** (RECTANGLE) `I1278:9424;1278:9403`
│ │ ├── Fill: IMAGE (imageHash: 5dfa6fe1...)
│ │ └── **Dimensions:** 80 × 51 px
│ │
│ ├── 📝 **next** (TEXT) `I1278:9424;1278:9406`
│ │ ├── Content: "Next: 12%"
│ │ ├── Font: Lato Bold, 32px
│ │ └── Color: White (#FFFFFF)
│ │
│ ├── 🔷 **progess bar** (INSTANCE) `I1278:9424;1278:9407`
│ │ ├── Component: `progess bar`
│ │ ├── **Dimensions:** 308 × 34 px
│ │ │
│ │ ├── ▢ **track** (RECTANGLE) `I1278:9424;1278:9407;1264:6964`
│ │ │ ├── Fill: Dark (#0A0A1A)
│ │ │ ├── Corner Radius: 50px
│ │ │ └── **Dimensions:** 308 × 34 px
│ │ │
│ │ └── ▢ **thumb** (RECTANGLE) `I1278:9424;1278:9407;1264:6962`
│ │ ├── Fill: Green (#5DA379)
│ │ ├── Corner Radius: 50px
│ │ └── **Dimensions:** 125 × 34 px
│ │
│ ├── 📝 **count** (TEXT) `I1278:9424;1278:9404`
│ │ ├── Content: "120"
│ │ ├── Font: Lato Black, 72px
│ │ ├── Color: White (#FFFFFF)
│ │ └── Effect: Drop Shadow
│ │
│ └── 📝 **title** (TEXT) `I1278:9424;1278:9405`
│ ├── Content: "YOUR TICKETS"
│ ├── Font: Lato Black, 32px
│ ├── Color: White (#FFFFFF)
│ └── Effect: Drop Shadow
│
├── 🔷 **tickets - golden** (INSTANCE) `1278:9435`
│ ├── Component: `tickets - golden`
│ ├── **Dimensions:** 430 × 474 px
│ │
│ ├── 📁 **background** (GROUP) `I1278:9435;1278:9423`
│ │ │
│ │ ├── ▢ **frame** (RECTANGLE) `I1278:9435;1278:9413`
│ │ │ ├── Fill: IMAGE (imageHash: ec43dd37...)
│ │ │ └── **Dimensions:** 430 × 474 px
│ │ │
│ │ └── ▢ **ticket - golden** (RECTANGLE) `I1278:9435;1278:9417`
│ │ ├── Fill: IMAGE (imageHash: 4a71ab6e...)
│ │ └── **Dimensions:** 88 × 64 px
│ │
│ ├── 📝 **next** (TEXT) `I1278:9435;1278:9415`
│ │ ├── Content: "Next: 10/100"
│ │ ├── Font: Lato Bold, 32px
│ │ └── Color: White (#FFFFFF)
│ │
│ ├── 🔷 **progess bar** (INSTANCE) `I1278:9435;1278:9418`
│ │ ├── Component: `progess bar`
│ │ ├── **Dimensions:** 308 × 34 px
│ │ │
│ │ ├── ▢ **track** (RECTANGLE) `I1278:9435;1278:9418;1264:6964`
│ │ │ ├── Fill: Dark Brown (#251107)
│ │ │ ├── Corner Radius: 50px
│ │ │ └── **Dimensions:** 308 × 34 px
│ │ │
│ │ └── ▢ **thumb** (RECTANGLE) `I1278:9435;1278:9418;1264:6962`
│ │ ├── Fill: Gold (#F4BB36)
│ │ ├── Corner Radius: 50px
│ │ └── **Dimensions:** 125 × 34 px
│ │
│ ├── 📝 **count** (TEXT) `I1278:9435;1278:9414`
│ │ ├── Content: "12"
│ │ ├── Font: Lato Black, 72px
│ │ ├── Color: Golden (#FEF0A4)
│ │ └── Effect: Drop Shadow
│ │
│ └── 📝 **title** (TEXT) `I1278:9435;1278:9416`
│ ├── Content: "GOLDEN TICKETS"
│ ├── Font: Lato Black, 32px
│ ├── Color: Golden (#FEF0A4)
│ └── Effect: Drop Shadow
│
└── 🔷 **prize** (INSTANCE) `1278:9449`
├── Component: `prize`
├── **Dimensions:** 546 × 134 px
│
└── 📝 **text** (TEXT) `I1278:9449;1278:9446`
├── Content: "Prize"
├── Font: Lato Black, 96px
├── Fill: Gradient (Golden Yellow to Orange)
└── Stroke: Golden (#FEF359), 1px

---

### 📁 2. draw (GROUP) `1276:7684`

├── **Dimensions:** 1024 × 1536 px
│
├── 🔷 **background** (INSTANCE) `1278:9578`
│ ├── Component: `background`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ └── 📁 **visuals** (FRAME) `I1278:9578;1278:9303`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ ├── ▢ **background - draw** (RECTANGLE) `I1278:9578;1278:9307`
│ │ ├── Fill: IMAGE (imageHash: e2d2c821...)
│ │ └── **Dimensions:** 1024 × 1536 px
│ │
│ ├── 📝 **title** (TEXT) `I1278:9578;1278:9326`
│ │ ├── Content: "Grand Prize Pool"
│ │ ├── Font: Lato Regular, 64px
│ │ ├── Color: White (#FFFFFF)
│ │ └── Effect: Drop Shadow
│ │
│ └── 📝 **subtext** (TEXT) `I1278:9578;1278:9327`
│ ├── Content: "Keep playing to earn tickets..."
│ ├── Font: Lato Black, 32px
│ └── Color: Golden (#FEF0A4)
│
├── 🔷 **countdown** (INSTANCE) `1278:9579`
│ ├── Component: `countdown`
│ ├── **Dimensions:** 738 × 385 px
│ │
│ ├── 📁 **background** (GROUP)
│ │ ├── ▢ **frame - wide** (RECTANGLE)
│ │ └── 📁 **top** (GROUP)
│ │ ├── ▢ **frame - round small** (RECTANGLE)
│ │ └── 📝 **NEXT DRAW IN** (TEXT)
│ │
│ └── 📁 **digits** (FRAME) - 8 number instances
│ ├── 🔷 numbers × 8 (countdown display: 09:00:20)
│ └── Each contains digit RECTANGLE
│
├── 🔷 **winnerslist** (INSTANCE) `1278:9471`
│ ├── Component: `winnerslist`
│ ├── **Dimensions:** 794 × 576 px
│ ├── Layout: VERTICAL, spacing: 8px
│ │
│ ├── 📁 **background** (GROUP)
│ │ └── 📁 **top** (GROUP)
│ │ ├── ▢ **frame - round small** (RECTANGLE)
│ │ └── 📝 **TOP WINNERS** (TEXT) - "TOP WINNERS"
│ │
│ ├── 🔷 **winner** (INSTANCE) `I1278:9471;1276:9105` - Winner #1
│ │ ├── Component: `winner`
│ │ ├── **Dimensions:** 794 × 116 px
│ │ ├── ▢ **background** (RECTANGLE) - Row background image
│ │ ├── 📝 **name** (TEXT) - "Margaretha M."
│ │ ├── 📝 **rank** (TEXT) - "1"
│ │ └── 📝 **prize** (TEXT) - "Free SC 12"
│ │
│ ├── 🔷 **winner** (INSTANCE) `I1278:9471;1276:9111` - Winner #2
│ │ └── (Same structure as above)
│ │
│ ├── 🔷 **winner** (INSTANCE) `I1278:9471;1276:9116` - Winner #3
│ │ └── (Same structure as above)
│ │
│ └── 🔷 **winner** (INSTANCE) `I1278:9471;1276:9121` - Winner #4
│ └── (Same structure as above)
│
└── 🔷 **prize** (INSTANCE) `1278:9617`
├── Component: `prize`
├── **Dimensions:** 546 × 134 px
│
└── 📝 **text** (TEXT) `I1278:9617;1278:9446`
├── Content: "FREE SC 12"
├── Font: Lato Black, 96px
├── Fill: Gradient (Golden)
└── Effect: Drop Shadow

---

### 📁 3. win (GROUP) `1276:7687`

├── **Dimensions:** 1024 × 1536 px
│
├── 🔷 **background** (INSTANCE) `1278:9612`
│ ├── Component: `background`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ └── 📁 **visuals** (FRAME)
│ ├── ▢ **background - win** (RECTANGLE) - Victory background
│ ├── 📝 **title** (TEXT) - "YOU WON!"
│ └── 📝 **subtext** (TEXT) - Win message
│
├── 🔷 **button** (INSTANCE) `1276:7681`
│ ├── Component: `button`
│ ├── **Dimensions:** 310 × 120 px
│ │
│ └── 📝 **DEFAULT** (TEXT) - "CLAIM" button text
│
├── 🔷 **winnerslist** (INSTANCE) `1278:9471` (Duplicate reference)
│ ├── Component: `winnerslist`
│ ├── **Dimensions:** 794 × 576 px
│ │
│ ├── 📁 **background** (GROUP)
│ │ └── 📁 **top** (GROUP)
│ │ ├── ▢ **frame - round small** (RECTANGLE)
│ │ └── 📝 **TOP WINNERS** (TEXT)
│ │
│ └── 🔷 **winner** × 4 (INSTANCE) - Winner rows
│ └── Each with: background, name, rank, prize
│
└── 🔷 **prize** (INSTANCE) `1278:9617`
└── 📝 **text** (TEXT) - "FREE SC 12"

---

### 📁 4. fail (GROUP) `1276:9193`

├── **Dimensions:** 1024 × 1537 px
│
├── 🔷 **background** (INSTANCE) `1278:9623`
│ ├── Component: `background`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ └── 📁 **visuals** (FRAME) `I1278:9623;1278:9313`
│ ├── **Dimensions:** 1024 × 1536 px
│ │
│ ├── ▢ **background - fail** (RECTANGLE) `I1278:9623;1278:9304`
│ │ ├── Fill: IMAGE (same as active background)
│ │ └── **Dimensions:** 1024 × 1536 px
│ │
│ └── 📝 **title** (TEXT) `I1278:9623;1278:9330`
│ ├── Content: "NO WIN THIS TIME"
│ ├── Font: Lato Regular, 64px
│ ├── Color: White (#FFFFFF)
│ └── Effect: Drop Shadow
│
├── 🔷 **button** (INSTANCE) `1276:9213`
│ ├── Component: `button`
│ ├── **Dimensions:** 310 × 120 px
│ ├── Fill: Gradient (Cyan to Teal)
│ ├── Stroke: #9FFFF8, 2px
│ ├── Corner Radius: 50px
│ │
│ └── 📝 **DEFAULT** (TEXT) `I1276:9213;1265:6977`
│ ├── Content: "TRY AGAIN"
│ ├── Font: Lato Black, 42px
│ └── Color: White (#FFFFFF)
│
├── 🔷 **winnerslist** (INSTANCE) `1278:9547`
│ ├── Component: `winnerslist`
│ ├── **Dimensions:** 794 × 576 px
│ ├── Layout: VERTICAL, spacing: 8px
│ │
│ ├── 📁 **background** (GROUP) `I1278:9547;1278:9469`
│ │ │
│ │ └── 📁 **top** (GROUP) `I1278:9547;1276:9188`
│ │ │
│ │ ├── ▢ **frame - round small** (RECTANGLE) `I1278:9547;1276:9189`
│ │ │ └── Fill: IMAGE (golden frame)
│ │ │
│ │ └── 📝 **TOP WINNERS** (TEXT) `I1278:9547;1276:9190`
│ │ ├── Content: "TOP WINNERS"
│ │ ├── Font: Lato Bold, 24px
│ │ └── Color: Golden (#FDF98F)
│ │
│ ├── 🔷 **winner** (INSTANCE) `I1278:9547;1276:9105`
│ │ ├── Component: `winner`
│ │ ├── **Dimensions:** 794 × 116 px
│ │ │
│ │ ├── ▢ **background** (RECTANGLE) `I1278:9547;1276:9105;1276:9098`
│ │ │ └── Fill: IMAGE (row background)
│ │ │
│ │ ├── 📝 **name** (TEXT) `I1278:9547;1276:9105;1276:9100`
│ │ │ ├── Content: "Margaretha M."
│ │ │ ├── Font: Lato Regular, 40px
│ │ │ └── Color: White (#FFFFFF)
│ │ │
│ │ ├── 📝 **rank** (TEXT) `I1278:9547;1276:9105;1276:9102`
│ │ │ ├── Content: "1"
│ │ │ ├── Font: Lato Black, 40px
│ │ │ └── Color: White (#FFFFFF)
│ │ │
│ │ └── 📝 **prize** (TEXT) `I1278:9547;1276:9105;1276:9101`
│ │ ├── Content: "Free SC 12"
│ │ ├── Font: Lato Regular, 40px
│ │ └── Color: White (#FFFFFF)
│ │
│ ├── 🔷 **winner** (INSTANCE) `I1278:9547;1276:9111` - Winner #2
│ │ └── (Same structure)
│ │
│ ├── 🔷 **winner** (INSTANCE) `I1278:9547;1276:9116` - Winner #3
│ │ └── (Same structure)
│ │
│ └── 🔷 **winner** (INSTANCE) `I1278:9547;1276:9121` - Winner #4
│ └── (Same structure)
│
├── 🔷 **countdown** (INSTANCE) `1278:9522`
│ ├── Component: `countdown`
│ ├── **Dimensions:** 738 × 385 px
│ │
│ ├── 📁 **background** (GROUP) `I1278:9522;1278:9341`
│ │ │
│ │ ├── ▢ **frame - wide** (RECTANGLE) `I1278:9522;1278:9343`
│ │ │ └── Fill: IMAGE (wide frame)
│ │ │
│ │ └── 📁 **top** (GROUP) `I1278:9522;1278:9344`
│ │ │
│ │ ├── ▢ **frame - round small** (RECTANGLE) `I1278:9522;1278:9345`
│ │ │ └── Fill: IMAGE (golden frame)
│ │ │
│ │ └── 📝 **NEXT DRAW IN** (TEXT) `I1278:9522;1278:9346`
│ │ ├── Content: "NEXT DRAW IN"
│ │ ├── Font: Lato Bold, 24px
│ │ └── Color: Golden (#FDF98F)
│ │
│ └── 📁 **digits** (FRAME) `I1278:9522;1278:9347`
│ ├── Layout: HORIZONTAL, spacing: 8px
│ ├── **Dimensions:** 536 × 90 px
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9348`
│ │ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9349`
│ │ └── ▢ **09_9** (RECTANGLE) - Digit "9"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9350`
│ │ └── ▢ **10_colon** (RECTANGLE) - Colon ":"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9351`
│ │ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9352`
│ │ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9353`
│ │ └── ▢ **10_colon** (RECTANGLE) - Colon ":"
│ │
│ ├── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9354`
│ │ └── ▢ **02_2** (RECTANGLE) - Digit "2"
│ │
│ └── 🔷 **numbers** (INSTANCE) `I1278:9522;1278:9355`
│ └── ▢ **00_0** (RECTANGLE) - Digit "0"
│
└── 🔷 **prize** (INSTANCE) `1278:9620`
├── Component: `prize`
├── **Dimensions:** 546 × 134 px
│
└── 📝 **text** (TEXT) `I1278:9620;1278:9446`
├── Content: "FREE SC 0"
├── Font: Lato Black, 96px
├── Fill: Gradient (Golden Yellow to Orange)
├── Stroke: Golden (#FEF359)
└── Effect: Drop Shadow

---

## Component Summary

### Reusable Components Identified

| Component Name         | Usage Count | Description                             |
| ---------------------- | ----------- | --------------------------------------- |
| `background - default` | 1           | Main screen background with imagery     |
| `background`           | 3           | Generic background for different states |
| `countdown`            | 3           | Timer display with digits frame         |
| `numbers`              | 24          | Individual digit display (0-9, colon)   |
| `button`               | 3           | CTA button with gradient and glow       |
| `tickets - normal`     | 1           | Regular ticket counter card             |
| `tickets - golden`     | 1           | Golden ticket counter card              |
| `progess bar`          | 2           | Progress indicator with track/thumb     |
| `prize`                | 4           | Large prize amount display              |
| `winnerslist`          | 3           | Winners leaderboard container           |
| `winner`               | 12          | Individual winner row                   |

---

## Typography Specifications

| Usage           | Font | Weight        | Size | Color          |
| --------------- | ---- | ------------- | ---- | -------------- |
| Main Title      | Lato | Regular (400) | 64px | White #FFFFFF  |
| Subtext         | Lato | Black (900)   | 32px | Golden #FEF0A4 |
| Button Text     | Lato | Black (900)   | 42px | White #FFFFFF  |
| Section Headers | Lato | Bold (700)    | 24px | Golden #FDF98F |
| Ticket Count    | Lato | Black (900)   | 72px | White/Golden   |
| Prize Display   | Lato | Black (900)   | 96px | Gradient       |
| Winner Name     | Lato | Regular (400) | 40px | White #FFFFFF  |
| Winner Rank     | Lato | Black (900)   | 40px | White #FFFFFF  |

---

## Color Palette

| Name          | Hex     | Usage                       |
| ------------- | ------- | --------------------------- |
| White         | #FFFFFF | Primary text                |
| Golden Light  | #FEF0A4 | Accent text, golden tickets |
| Golden        | #FDF98F | Headers, labels             |
| Golden Dark   | #F39C13 | Gradient end                |
| Cyan Bright   | #47FFF4 | Button gradient start       |
| Teal          | #0586AE | Button gradient end         |
| Green         | #5DA379 | Normal ticket progress      |
| Gold Progress | #F4BB36 | Golden ticket progress      |
| Dark Track    | #0A0A1A | Progress track              |
| Dark Brown    | #251107 | Golden progress track       |

---

## Node Statistics

- **Total Nodes:** 200+
- **Groups:** 15
- **Frames:** 12
- **Instances:** 52
- **Rectangles:** 58
- **Text Nodes:** 54
- **Maximum Depth:** 6 levels

---

## Image Assets (by imageHash)

| Hash (truncated) | Usage                        |
| ---------------- | ---------------------------- |
| 97879163...      | Background - active/fail     |
| e2d2c821...      | Background - draw            |
| 6b00a575...      | Countdown frame - wide       |
| b2d59f68...      | Frame - round small (golden) |
| d28617b6...      | Digit "0"                    |
| dc120325...      | Digit "9"                    |
| 0b6514bf...      | Colon ":"                    |
| aabd882b...      | Digit "2"                    |
| d25fd6a5...      | Ticket frame (normal)        |
| ec43dd37...      | Ticket frame (golden)        |
| 5dfa6fe1...      | Ticket icon (normal)         |
| 4a71ab6e...      | Ticket icon (golden)         |
| 2772148b...      | Winner row background        |
