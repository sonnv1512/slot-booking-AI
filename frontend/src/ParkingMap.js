import API_BASE from './config';
import { useState, useEffect } from 'react';
import './ParkingMap.css';

function ParkingMap({ selectedDate, availableSpaces, allSpaces, userId }) {

    const [showFullMap, setShowFullMap] = useState(false);
    const [allSlots, setAllSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(true);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const response = await fetch(API_BASE + '/api/spaces');
                const data = await response.json();
                const sorted = data.sort((a, b) => {
                    const aNum = parseInt(a.parking_slot_number);
                    const bNum = parseInt(b.parking_slot_number);
                    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                    return String(a.parking_slot_number).localeCompare(String(b.parking_slot_number));
                });
                setAllSlots(sorted);
            } catch (error) {
                console.error('Error fetching parking slots:', error);
            } finally {
                setSlotsLoading(false);
            }
        };
        fetchSlots();
    }, []);

    // figure out if a space is availble or not
    function getSpaceColor(spaceNumber) {
        if (!selectedDate) {
            return 'neutral';
        }

        const isAvailable = availableSpaces.some(
            space => space.parking_slot_number === spaceNumber
        );

        return isAvailable ? 'available' : 'booked';
    }

    // book a space when they click it
    function handleSpaceClick(spaceNumber) {
        if (!selectedDate) {
            alert('Please select a date first!');
            return;
        }

        const isAvailable = availableSpaces.some(
            space => space.parking_slot_number === spaceNumber
        );

        if (!isAvailable) {
            alert(`Space ${spaceNumber} is already booked for ${selectedDate}`);
            return;
        }

        const confirmed = window.confirm(
            `Book Space ${spaceNumber} for ${selectedDate}?`
        );

        if (confirmed) {
            fetch(API_BASE + '/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    user_id: userId,
                    parking_slot_number: spaceNumber,
                    booking_date: selectedDate
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(`Successfully booked Space ${spaceNumber}!`);
                        window.location.reload();
                    } else {
                        alert('Booking failed: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error booking space:', error);
                    alert('Failed to book space. Please try again.');
                });
        }
    }

    // get the tooltip text for a space numebr
    function getTooltipText(spaceNumber) {
        if (!selectedDate) {
            return 'Select a date first';
        }

        const isAvailable = availableSpaces.some(
            space => space.parking_slot_number === spaceNumber
        );

        if (isAvailable) {
            return `Click to book Space ${spaceNumber}`;
        } else {
            return `Space ${spaceNumber} - Already booked`;
        }
    }

    // group slots into: consecutive numeric runs, numSuffix variants (12A/12B), letterPrefix zones (A1/B1)
    function groupSlots(slots) {
        const numSuffixPat = /^(\d+)[a-zA-Z]/;
        const letterPrefixPat = /^[a-zA-Z]+\d/;
        const suffixMap = {}, prefixMap = {}, pure = [], other = [];

        slots.forEach(slot => {
            const s = String(slot.parking_slot_number).trim();
            if (/^\d+$/.test(s)) {
                pure.push(slot);
            } else if (numSuffixPat.test(s)) {
                const base = s.match(/^(\d+)/)[1];
                (suffixMap[base] = suffixMap[base] || []).push(slot);
            } else if (letterPrefixPat.test(s)) {
                const prefix = s.match(/^([a-zA-Z]+)/)[1].toUpperCase();
                (prefixMap[prefix] = prefixMap[prefix] || []).push(slot);
            } else {
                other.push(slot);
            }
        });

        // group pure numbers into consecutive runs
        pure.sort((a, b) => +a.parking_slot_number - +b.parking_slot_number);
        const runs = [];
        let run = [];
        pure.forEach(slot => {
            const n = +slot.parking_slot_number;
            if (!run.length || n - +run[run.length - 1].parking_slot_number === 1) {
                run.push(slot);
            } else {
                runs.push([...run]);
                run = [slot];
            }
        });
        if (run.length) runs.push(run);

        const sortByName = arr => arr.sort((a, b) =>
            String(a.parking_slot_number).localeCompare(String(b.parking_slot_number), undefined, { numeric: true })
        );
        Object.values(suffixMap).forEach(sortByName);
        Object.values(prefixMap).forEach(sortByName);

        const all = [
            ...runs,
            ...Object.values(suffixMap),
            ...Object.values(prefixMap),
            ...other.map(s => [s])
        ];

        // sort groups by their first slot's numeric value
        all.sort((a, b) => {
            const key = g => parseInt(String(g[0].parking_slot_number).replace(/\D/g, '') || '0');
            return key(a) - key(b);
        });

        return all;
    }

    const heading = selectedDate
        ? `Available on ${selectedDate}:`
        : 'Short-Term Parking Spaces';

    if (slotsLoading) {
        return <div className="loading">Loading parking spaces...</div>;
    }

    const groups = groupSlots(allSlots);

    return (
        <div className="parking-map-container">

            <div className="map-header">
                <h2>{heading}</h2>
            </div>

            {/* parking spaces grid */}
            <div className="spaces-grid">
                {groups.map((group, groupIdx) => (
                    <div key={groupIdx} className="slot-group">
                        {group.map(slotObj => (
                            <div
                                key={slotObj.parking_slot_number}
                                className={`space-box-grid ${getSpaceColor(slotObj.parking_slot_number)}`}
                                onClick={() => handleSpaceClick(slotObj.parking_slot_number)}
                                title={getTooltipText(slotObj.parking_slot_number)}
                            >
                                {slotObj.parking_slot_number}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* btn to show the full map */}
            <button
                className="full-map-btn"
                onClick={() => setShowFullMap(true)}
            >
                Show Full Map
            </button>

            {/* full map modal popup thing */}
            {showFullMap && (
                <div className="modal-overlay" onClick={() => setShowFullMap(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="close-btn"
                            onClick={() => setShowFullMap(false)}
                        >
                            ✕
                        </button>

                        <img
                            src="/images/parking-map-full.png"
                            alt="Full parking lot map"
                            className="full-map-image"
                        />
                    </div>
                </div>
            )}

        </div>
    );
}

export default ParkingMap;
