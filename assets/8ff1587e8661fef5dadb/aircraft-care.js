export function normalizeAircraft(value) { const v = value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^AIRBUS/, ''); if (v === 'A321NEO' || v === 'A21N')
    return 'A321neo'; if (v === 'A350900' || v === 'A359')
    return 'A350-900'; if (v === 'A3501000' || v === 'A35K')
    return 'A350-1000'; if (v === 'A350')
    return 'A350'; if (v === 'A330' || v === 'A330300' || v === 'A333')
    return 'A330'; return null; }
export const BASSINET_RULE = { version: 'CX-bassinet-2026-10-18', carrier: 'CX', service: 'bassinet', source: 'https://www.cathaypacific.com/cx/zh_HK/prepare-trip/help-for-passengers/travelling-with-children/safety-seats-and-devices/bassinet.html', verifiedAt: '2026-10-18' };
export function bassinetAvailability(aircraft, carrier = 'CX') { const type = normalizeAircraft(aircraft); if (carrier !== 'CX')
    return 'verify'; return type === 'A321neo' ? 'unavailable' : type ? 'pending' : 'verify'; }
// Finite catalog fixtures. These are layouts for the same configured candidate instance,
// not a claim of live aircraft allocation or sellable airline inventory.
export function aircraftLayout(aircraft, cabin = 'economy') { const type = normalizeAircraft(aircraft); if (!type)
    return []; const blocks = cabin === 'business' ? ['A', 'D', 'G', 'K'] : type === 'A321neo' ? ['ABC', 'DEF'] : type === 'A330' ? ['AC', 'DEFG', 'HK'] : ['ABC', 'DEG', 'HJK']; return Array.from({ length: 10 }, (_, i) => blocks.flatMap(block => [...block].map((letter, index) => ({ id: (20 + i) + letter, block: (20 + i) + block, index })))).flat(); }
export function seatsAdjacent(layout, a, b) { const x = layout.find(s => s.id === a), y = layout.find(s => s.id === b); return !!x && !!y && x.block === y.block && Math.abs(x.index - y.index) === 1; }
