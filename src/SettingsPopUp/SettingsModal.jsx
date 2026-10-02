import React, { useState } from 'react';
import styles from './SettingsModal.module.scss';
import { ToggleSwitch } from './ToggleSwitch';

const settingsData = [
  { id: 'audio', label: 'Audio' },
  { id: 'soundEffects', label: 'Sound effects' },
  { id: 'notifications', label: 'Notifications' }
];

export const SettingsModal = () => {
  const [settings, setSettings] = useState({
    audio: false,
    soundEffects: false,
    notifications: false
  });

  const handleToggle = (settingId) => {
    setSettings(prev => ({
      ...prev,
      [settingId]: !prev[settingId]
    }));
  };

  return (
    <div className={styles.settingsModal}>
      <div className={styles.header}>
        <div className={styles.title}>Settings</div>
        <img
          loading="lazy"
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/3718e4e6a92704c8ea347c0d8b1901d20b4196c41d7e0ac9bb813615cf9e1232?placeholderIfAbsent=true&apiKey=b8d7041a24ed4a8e80433853cda3ec05"
          className={styles.icon}
          alt=""
        />
      </div>
      <div className={styles.content}>
        <div className={styles.settingsList}>
          {settingsData.map(({ id, label }) => (
            <ToggleSwitch
              key={id}
              id={id}
              label={label}
              checked={settings[id]}
              onChange={() => handleToggle(id)}
            />
          ))}
          <div className={styles.playbackControl}>
            <div className={styles.playbackLabel}>Playback speed</div>
            <div 
              className={styles.playbackSelector}
              role="button"
              tabIndex={0}
            >
              <img
                loading="lazy"
                src="https://cdn.builder.io/api/v1/image/assets/TEMP/ee22e617264c71ca3596fcd16af934f2662875d392f53d0e82b38bff17679472?placeholderIfAbsent=true&apiKey=b8d7041a24ed4a8e80433853cda3ec05"
                className={styles.icon}
                alt=""
              />
              <div className={styles.playbackText}>Medium(Default)</div>
              <img
                loading="lazy"
                src="https://cdn.builder.io/api/v1/image/assets/TEMP/da29f87bb902cc8d26685f36ccf815c09ac98c8b057221c4823d535eae859d56?placeholderIfAbsent=true&apiKey=b8d7041a24ed4a8e80433853cda3ec05"
                className={styles.icon}
                alt=""
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};