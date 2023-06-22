import { NeventResult } from 'service/nip/21';
import { Avatar } from 'antd';
import { shortifyPublicKey } from 'service/nostr/content';
import { MediaPreviews } from '../Media';
import { Paths } from 'constants/path';
import { i18n } from 'next-i18next';

import styles from './index.module.scss';

export const Nevent = (nevent: NeventResult) => {
  if (nevent.noteEvent) {
    return (
      <div className={styles.refNote}>
        <div>
          <Avatar src={''} alt="picture" /> @
          {shortifyPublicKey(nevent.noteEvent.pubkey)}
        </div>
        {nevent.noteEvent.content}
        <MediaPreviews content={nevent.noteEvent.content} />
      </div>
    );
  }

  return (
	<div className={styles.refLink}>
    <a
      href={'/' + i18n?.language + Paths.user + '/' + nevent.decodedMetadata.id}
      target="_self"
    >
      nevent@${nevent.decodedMetadata.id}
    </a>
    </div>
  );
};
