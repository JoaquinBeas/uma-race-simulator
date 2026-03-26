import React from 'react';

import './Tooltip.css';

export function Tooltip(props: { children: React.ReactNode, title: string, tall?: boolean }) {
	return (
		<div className={`hasTooltip${props.tall ? ' contentIsTall' : ''}`}>
			{props.children}
			<div className="tooltip">{props.title}<span className="arrow" /></div>
		</div>
	);
}
