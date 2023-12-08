import { UrlMetadata, getUrlMetadata } from 'core/ogp';
import { getBaseUrl, maxStrings } from 'utils/common';
import { useEffect, useState } from 'react';

import styles from '../index.module.scss';

export const URLPreview = ({ url }: { url: string }) => {
  const [data, setData] = useState<UrlMetadata>();

  async function fetchData() {
    try {
      const data = await getUrlMetadata(url);
      data.url = data.url || url;
      setData(data);
    } catch (error) {
      console.error(error);
    }
  }
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div
      className={styles.preview}
      onClick={() => {
        window.open(url, '_blank');
      }}
    >
      <div>
        {<div className={styles.baseUrl}>{getBaseUrl(url)}</div>}
        {data?.title && (
          <div className={styles.siteTitle}>{maxStrings(data.title, 45)}</div>
        )}
        {data?.description && (
          <div className={styles.siteDescription}>
            {maxStrings(data.description, 100)}
          </div>
        )}
      </div>
      {data?.image && (
        <div className={styles.cover}>
          <img src={data.image} alt={data.title} />
        </div>
      )}
    </div>
  );
};