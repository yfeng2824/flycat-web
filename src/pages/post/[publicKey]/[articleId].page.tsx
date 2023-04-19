import { ThinHr } from 'components/layout/ThinHr';
import { UserMap } from 'service/type';
import { useTheme } from '@mui/material';
import { RootState } from 'store/configureStore';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { CallRelayType } from 'service/worker/type';
import { useCallWorker } from 'hooks/useWorker';
import { ImageUploader } from 'components/layout/PubNoteTextarea';
import { useTranslation } from 'next-i18next';
import { Article, Nip23 } from 'service/nip/23';
import { Nip08, RenderFlag } from 'service/nip/08';
import { TextField, Button } from "@mui/material";
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useReadonlyMyPublicKey } from 'hooks/useMyPublicKey';
import { BaseLayout, Left, Right } from 'components/layout/BaseLayout';
import { useEffect, useMemo, useState } from 'react';
import { Event, EventSetMetadataContent, EventTags, WellKnownEventKind } from 'service/api';
import { dontLikeComment, findNodeById, parseLikeData, replyComments } from './util';

import styles from './index.module.scss';
import Swal from 'sweetalert2/dist/sweetalert2.js';
import Comment from './components/Comment';
import PostContent from './components/PostContent';
import ReplyDialog from './components/ReplyDialog';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';

type UserParams = {
  publicKey: string;
  articleId: string;
}
export interface newComments extends Event {
  replys: object;
  likes: object;
  isLike: boolean;
}

export default function NewArticle() {
  const theme = useTheme();
  const { t } = useTranslation();
  const query = useRouter().query as UserParams;
  const myPublicKey = useReadonlyMyPublicKey();
  const { publicKey } = query;
  const articleId = decodeURIComponent(query.articleId);
  const { worker, newConn } = useCallWorker();

  const signEvent = useSelector((state: RootState) => state.loginReducer.signEvent);
  
  const [image, setImage] = useState('');
  const [replyId, setReplyId] = useState('');
  const [userMap, setUserMap] = useState<UserMap>(new Map());
  const [article, setArticle] = useState<Article>();
  const [comments, setComments] = useState<newComments[]>([]);
  const [replyComment, setReplyComment] = useState<newComments>();
  const [replyDialog, setReplyDialog] = useState(false);
  const [inputComment, setInputComment] = useState('');
  const [articleEvent, setArticleEvent] = useState<Event>();

  const handleCommentSubmit = async () => {
    if (signEvent == null) {
      Swal.fire({
        icon: 'error',
        text: 'sign method not found'
      });
      return;
    }
    if (article == null) {
      Swal.fire({
        icon: 'error',
        text: 'article is not loaded'
      });
      return;
    }
    if (worker == null) {
      Swal.fire({
        icon: 'error',
        text: 'worker is null'
      });
      return;
    }

    let content = inputComment;
    if (image) content = (content + "\n" + image).trim();

    const rawEvent = Nip23.commentToArticle(content, article);
    const event = await signEvent(rawEvent);
    worker?.pubEvent(event);
    setInputComment('');
    setImage('');
    Swal.fire({
      icon: 'success',
      text: t("comment.success"),
    });
  };

  function handleEvent(event: Event, relayUrl?: string) {
    if (event.kind === WellKnownEventKind.set_metadata) {
      const metadata: EventSetMetadataContent = JSON.parse(event.content);
      setUserMap(prev => {
        const newMap = new Map(prev);
        const oldData = newMap.get(event.pubkey);
        if (oldData && oldData.created_at > event.created_at) return newMap;

        newMap.set(event.pubkey, {
          ...metadata,
          ...{ created_at: event.created_at },
        });
        return newMap;
      });
      return;
    }

    if (event.kind === WellKnownEventKind.long_form) {
      if (event.pubkey !== publicKey) return;
      const article = Nip23.toArticle(event);
      setArticle(prevArticle => {
        if (!prevArticle || article?.updated_at >= prevArticle.updated_at) {
          return article;
        }
        return prevArticle;
      });
      setArticleEvent(prev => {
        if (!prev || prev?.created_at < event.created_at) {
          return event;
        }
        return prev;
      });
      return;
    }

    if (event.kind === WellKnownEventKind.text_note) {
      setComments(prev => {
        if (!prev.map(p => p.id).includes(event.id)) {
          worker?.subMsgByETags([event.id])?.iterating({ cb: replyComments(event) });

          return [...prev, event].sort((a, b) => a.created_at >= b.created_at ? 1 : -1) as newComments[];
        }

        return prev;
      });

      return;
    }
  }

  useEffect(() => {
    if (newConn.length === 0) return;

    const callRelay = {
      type: CallRelayType.batch,
      data: newConn,
    };

    worker
      ?.subMetadata([publicKey as string], undefined, undefined, callRelay)
      ?.iterating({ cb: handleEvent });
    const filter = Nip23.filter({
      authors: [publicKey as string],
      articleIds: [articleId as string],
    });
    worker
      ?.subFilter(filter, undefined, 'article-data', callRelay)
      ?.iterating({ cb: handleEvent });
  }, [newConn, publicKey]);

  useEffect(() => {
    if (article == null) return;

    worker
      ?.subFilter(Nip23.toPullCommentFilter(article), undefined, 'article-data')
      ?.iterating({ cb: handleEvent });
  }, [article]);

  useEffect(() => {
    if (!replyId.length || !Object.keys(replyComment || {}).length) return;
    
    const target = findNodeById(replyComment, replyId);
    if (!target) return;

    if (target.replys) {
      setReplyDialog(true);
      setReplyComment(target);
      const ids = Object.keys(target.replys);
      worker?.subMsgByETags(ids)?.iterating({ 
        cb: (event)=>{
          const tagIds = event.tags.filter(t => t[0] === EventTags.E).map(t => t[1] as string);
          for(const id of ids){
            if(tagIds.includes(id)){
              if (target.replys[id].replys) target.replys[id].replys[event.id] = event;
              else target.replys[id].replys = {[event.id]: event};
            }
          }
          setReplyComment({...replyComment, ...target});
        }
      });
    }
  }, [replyId]);

  const content = useMemo(() => {
    if (articleEvent == null) return;

    const event = articleEvent;
    event.content = Nip08.replaceMentionPublickey(
      event,
      userMap,
      RenderFlag.Markdown,
    );
    event.content = Nip08.replaceMentionEventId(event, RenderFlag.Markdown);
    return event.content;
  }, [articleEvent, userMap]);

  return (
    <BaseLayout silent={true}>
      <Left>
        <div className={styles.post}>
          <PostContent 
            article={article}
            publicKey={publicKey}
            userMap={userMap}
            articleId={articleId}
            content={content}
            t={t}
          />
          <div className={styles.comment} style={{ background: theme.palette.secondary.main }}>
            <div className={styles.commentPanel}>
              <TextField
                className={styles.textarea}
                multiline
                minRows={4}
                placeholder={t('comment.placeholder') as string}
                value={inputComment}
                onChange={(e) => setInputComment(e.target.value)}
              />
              { image && <div className={styles.image}>
                  <img src={image} alt="replyImage" />
                  <HighlightOffIcon onClick={() => setImage('')} />
                </div>
              }
              <div className={styles.footer}>
                <div className={styles.icons}>
                  <ImageUploader onImgUrls={url => setImage(url[0])} />
                </div>
                <Button disabled={!inputComment.length} variant="contained" size='large' onClick={handleCommentSubmit}>
                  {t('articleRead.submit')}
                </Button>
              </div>
            </div>
            <ThinHr></ThinHr>
            <Comment 
              comments={comments}
              worker={worker}
              userMap={userMap}
              setReplyId={setReplyId}
              setReplyComment={setReplyComment}
              notLike={(eventId) => dontLikeComment(worker, signEvent, eventId, myPublicKey)}
              like={(comment) => parseLikeData(comment, worker, signEvent, myPublicKey)}
            />
            <ReplyDialog
              open={replyDialog}
              onClose={() => {
                setReplyId('');
                setReplyDialog(false);
              }}
              comment={replyComment}
              userMap={userMap}
              worker={worker}
              t={t}
            />
          </div>
        </div>
      </Left>
      <Right></Right>
    </BaseLayout>
  );
}

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: { ...(await serverSideTranslations(locale, ['common'])) }
});

export const getStaticPaths = () => ({ paths: [], fallback: true });
