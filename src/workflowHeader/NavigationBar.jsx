import React from 'react';
import { CircleIcon } from './CircleIcon';
import styles from './NavigationBar.module.scss';

export function NavigationBar() {
  const circles = [1, 2, 3];

  return (
    <nav className={styles.topNavigation}>
      <div className={styles.circleGroup}>
        {circles.map((circle) => (
          <CircleIcon key={circle} />
        ))}
      </div>
      <div className={styles.notificationBadge}>
        <div className={styles.notificationCount}>24</div>
        <img
          loading="lazy"
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/d6b1546baf1046c8fff13124e37dab5ab11c201cb3cc36b920da58656ea14cc5?placeholderIfAbsent=true&apiKey=b8d7041a24ed4a8e80433853cda3ec05"
          className={styles.notificationIcon}
          alt="Notification icon"
        />
      </div>
    </nav>
  );
}