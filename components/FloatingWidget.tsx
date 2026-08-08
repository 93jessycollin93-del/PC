/**
 * FloatingWidget — the wrapper that makes a floating widget movable.
 *
 * Wrap a widget's outermost element in this and it gains drag + persistence:
 *
 *     <FloatingWidget id="command-orb" className="fixed bottom-6 right-6 z-50">
 *         <button …>⌘</button>
 *     </FloatingWidget>
 *
 * `className` still carries the widget's *default* position, so an untouched
 * widget renders exactly where it always did — the inline override only
 * appears once the user has actually moved it. That keeps adoption free of
 * layout regressions: nothing shifts until someone drags it.
 *
 * Move it with a click-and-drag on desktop, or a press-and-hold on touch.
 *
 * There is deliberately no double-click-to-reset here. Most floating widgets
 * ARE buttons (the terminal orb opens the terminal), and the first click of a
 * double-click fires that action before the reset lands — so the gesture would
 * both reset the position and trigger the widget. Reset lives in System
 * Settings → Appearance instead, and on FloatingNav's grip handle, which has
 * no action of its own to conflict with.
 */
import React from 'react';
import { useDraggableWidget } from '../src/desktop/useDraggableWidget';

interface FloatingWidgetProps {
    /** Stable id — the key this widget's position is stored under. */
    id: string;
    /** Default position + z-index, as Tailwind classes. */
    className?: string;
    children: React.ReactNode;
    /** Pin the widget in place (e.g. while it hosts an open menu). */
    draggable?: boolean;
    style?: React.CSSProperties;
    title?: string;
}

export const FloatingWidget: React.FC<FloatingWidgetProps> = ({
    id,
    className = '',
    children,
    draggable = true,
    style,
    title,
}) => {
    const { ref, handlers, style: dragStyle, isDragging, isArming } = useDraggableWidget({
        id,
        enabled: draggable,
    });

    return (
        <div
            ref={ref}
            {...handlers}
            title={title}
            className={[
                className,
                // `touch-none` only while arming/dragging: applying it always
                // would stop the page scrolling whenever a finger happens to
                // start on top of a widget.
                isDragging || isArming ? 'touch-none select-none' : '',
                isDragging ? 'cursor-grabbing' : '',
                // A subtle cue that the hold has registered and the widget is
                // about to become draggable.
                isArming ? 'scale-95 opacity-80 transition-transform duration-200' : '',
                isDragging ? 'ring-2 ring-indigo-400/70 shadow-2xl' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            style={{ ...style, ...dragStyle }}
        >
            {children}
        </div>
    );
};

export default FloatingWidget;
