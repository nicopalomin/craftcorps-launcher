import React from 'react';

const Shimmer = ({ className = '', style = {} }) => {
    return (
        <div
            className={`animate-shimmer rounded-xl ${className}`}
            style={style}
        />
    );
};

export default Shimmer;
