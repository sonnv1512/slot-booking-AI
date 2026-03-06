import { useState } from 'react';
import './ParkingMap.css';

function ParkingMap({ selectedDate, availableSpaces, allSpaces, userId }) {

    const [showFullMap, setShowFullMap] = useState(false);

    // top row and bottom row for the grid
    const topRow = [62, 61, 60];
    const bottomRow = [63, 64, 65];

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
            fetch('http://localhost:5000/api/bookings', {
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

    const heading = selectedDate
        ? `Available on ${selectedDate}:`
        : 'Short-Term Parking Spaces';

    return (
        <div className="parking-map-container">

            <div className="map-header">
                <h2>{heading}</h2>
            </div>

            {/* parking spaces grid */}
            <div className="spaces-grid">
                {/* top row: 62, 61, 60 */}
                <div className="grid-row">
                    {topRow.map(spaceNumber => (
                        <div
                            key={spaceNumber}
                            className={`space-box-grid ${getSpaceColor(spaceNumber)}`}
                            onClick={() => handleSpaceClick(spaceNumber)}
                            title={getTooltipText(spaceNumber)}
                        >
                            {spaceNumber}
                        </div>
                    ))}
                </div>

                {/* bottom row: 63, 64, 65 */}
                <div className="grid-row">
                    {bottomRow.map(spaceNumber => (
                        <div
                            key={spaceNumber}
                            className={`space-box-grid ${getSpaceColor(spaceNumber)}`}
                            onClick={() => handleSpaceClick(spaceNumber)}
                            title={getTooltipText(spaceNumber)}
                        >
                            {spaceNumber}
                        </div>
                    ))}
                </div>
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
