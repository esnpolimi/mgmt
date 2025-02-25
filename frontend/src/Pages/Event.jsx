import React from 'react';
import {useLocation} from 'react-router-dom';

export default function Event() {
    const location = useLocation();
    const {event} = location.state;

    return (
        <div>
            <h1>{event.name}</h1>
            <p>{event.description}</p>
            {/* Render other event details here */}
        </div>
    );
}