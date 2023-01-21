import React from 'react';

const styles = {
  simpleUl: {
    padding: '0px',
    margin: '20px 0px',
    listStyle: 'none' as const,
  },
  menu: {
    padding: '0px',
  },
};

export const NoticeBox = () => {
  return (
    <ul style={styles.simpleUl}>
      <li style={styles.menu}>
        <a href="http://">订阅号消息</a>
      </li>
      <li style={styles.menu}>
        <a href="http://">@提到我的</a>
      </li>
      {/** 
      <li style={styles.menu}>
        <a href="http://">私信</a>
      </li>
      */}
      <li style={styles.menu}>
        <a href="http://">互动消息</a>
      </li>
    </ul>
  );
};
