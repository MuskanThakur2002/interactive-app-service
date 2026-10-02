import React from 'react';
import styles from './ToggleSwitch.module.scss';

export const ToggleSwitch = ({ label, checked, onChange, id }) => {
  return (
    <div className={styles.toggleContainer}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.switch}>
        <div className={styles.switchTrack}>
          <div className={styles.handle}>
            <div className={styles.target}>
              <div className={styles.stateLayer}>
                <div 
                  className={styles.handleShape}
                  role="switch"
                  aria-checked={checked}
                  tabIndex={0}
                  id={id}
                  onClick={onChange}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onChange();
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};