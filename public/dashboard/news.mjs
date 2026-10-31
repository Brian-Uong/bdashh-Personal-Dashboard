import {apiFetch} from './api-client.mjs';
import {canEdit,requireOwner} from './dashboard-access.mjs';
import {findNewsTopics,newsTopic,newsEscape as esc,MAX_NEWS_TOPICS} from './news-data.mjs';
import {renderNewsCard} from './news-cards.mjs';
let mounted=false,saved=null,draft=[],dirty=false,busy=false,loading=false,topicFilter='all',articleQuery='',loadGeneration=0;
const root=()=>document.getElementById('newsView'),el=id=>root()?.querySelector('#'+id);
const say=(message,error=false)=>{el('newsStatus').textContent=message;el('newsStatus').classList.toggle('news-error',error);};
const sameTopics=(a,b)=>JSON.stringify(a.map(t=>t.id))===JSON.stringify(b.map(t=>t.id));
function renderSelections(){
 const count=draft.length;el('newsTopicCount').textContent=`${count} / ${MAX_NEWS_TOPICS} topics`;
 el('newsSelectedTopics').innerHTML=draft.map(t=>`<button type="button" class="news-topic-chip" data-remove-topic="${esc(t.id)}" ${!canEdit||busy?'disabled':''} aria-label="Remove ${esc(t.label)}">${esc(t.label)}<span aria-hidden="true">×</span></button>`).join('')||'<span class="news-hint">No topics selected. Add an interest below.</span>';
 el('newsSaveTopics').disabled=!canEdit||!dirty||busy;el('newsResetTopics').disabled=!dirty||busy;
 el('newsSaveTopics').textContent=busy?'Saving…':'Save topics';el('newsSelectionState').textContent=dirty?'Unsaved changes':'Saved across your dashboard';
 renderSuggestions();
}
function renderSuggestions(){
 const query=el('newsTopicSearch').value,choices=findNewsTopics(query).slice(0,query?8:6),ids=new Set(draft.map(t=>t.id));
 let custom;try{custom=newsTopic(query);}catch{}
 if(custom&&!choices.some(t=>t.id===custom.id)&&!ids.has(custom.id))choices.push({...custom,category:'Follow this topic'});
 el('newsTopicSuggestions').innerHTML=choices.map(t=>`<button type="button" class="news-suggestion" data-add-topic="${esc(t.label)}" ${ids.has(t.id)||draft.length>=MAX_NEWS_TOPICS||busy||!canEdit?'disabled':''}><span>${esc(t.label)}<small>${esc(t.category)}</small></span><b aria-hidden="true">${ids.has(t.id)?'✓':'＋'}</b></button>`).join('')||'<p class="news-hint">Enter a topic name between 2 and 60 characters.</p>';
 el('newsTopicLimit').textContent=draft.length>=MAX_NEWS_TOPICS?'All five spots are filled. Remove a topic to make room.':'Search a league, team, hobby, or any other interest.';
}
function renderFeed(){
 if(!saved)return;
 if(topicFilter!=='all'&&!saved.topics.some(t=>t.id===topicFilter))topicFilter='all';
 el('newsFilters').innerHTML=[{id:'all',label:'All topics'},...saved.topics].map(t=>`<button type="button" class="news-filter" data-news-filter="${esc(t.id)}" aria-pressed="${t.id===topicFilter}">${esc(t.label)}</button>`).join('');
 const topics=saved.topics.filter(t=>topicFilter==='all'||t.id===topicFilter);
 const html=topics.map(t=>renderNewsCard(t,saved.briefings[t.id],{query:articleQuery})).join('');
 el('newsCards').innerHTML=html||`<div class="pd-panel news-empty"><h2>${saved.topics.length?'No matching articles':'Make room for what you love.'}</h2><p>${saved.topics.length?'Try another keyword or clear the article search.':'Choose up to five topics above and save them to build your morning news feed.'}</p></div>`;
}
export async function loadNews({force=false,discardDraft=false}={}){
 if(!mounted||loading||busy||(!force&&(dirty||document.hidden||root().hidden)))return;
 const ticket=++loadGeneration;loading=true;el('newsReload').disabled=true;
 try{
  const response=await apiFetch('/api/news'),next=await response.json();
  if(!response.ok)throw Error(next.error||'News could not load.');
  if(ticket!==loadGeneration)return;
  if(dirty&&!discardDraft){if(saved&&next.topicsVersion!==saved.topicsVersion)say('Saved topics changed elsewhere. Your draft is kept; reload topics before saving.',true);return;}
  el('newsScheduleLabel').textContent=next.schedule?.enabled===false?'Updates paused · Website controls':'Every morning · Pacific time';
  dirty=false;saved=next;draft=next.topics.map(t=>({...t}));renderSelections();renderFeed();
  if(force)say('Loaded your saved topics and latest articles.');
 }catch(error){say(error.message,true);if(!saved)el('newsCards').innerHTML='<div class="pd-panel news-empty"><h2>News is temporarily unavailable</h2><p>Use Reload articles to try again.</p></div>';}
 finally{loading=false;el('newsReload').disabled=false;}
}
async function saveTopics(){
 if(busy||!dirty||!saved)return;
 try{
  requireOwner();loadGeneration++;busy=true;renderSelections();
  const response=await apiFetch('/api/news',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preferences',baseTopicsVersion:saved.topicsVersion,topics:draft.map(t=>t.label)})});
  const next=await response.json();if(!response.ok)throw Error(next.error||'Topics could not be saved.');
  saved=next;draft=next.topics.map(t=>({...t}));dirty=false;renderFeed();say(draft.length?'Topics saved. New selections join your next morning briefing.':'Topics saved. News updates are paused until you add a topic.');
 }catch(error){say(error.message,true);}finally{busy=false;renderSelections();}
}
export function mountNews(){
 if(mounted){void loadNews();return;}
 mounted=true;
 root().innerHTML=`<section class="pd-panel news-picker" aria-labelledby="newsPickerTitle"><div class="news-picker-heading"><div><span class="pd-kicker">CURATE YOUR MORNING</span><h2 id="newsPickerTitle">Your interests. Your daily edition.</h2><p>Follow up to five topics. Each gets its own briefing with at least five new articles requested every morning.</p></div><div class="news-schedule"><span aria-hidden="true">◷</span><div><strong>7:00 AM</strong><small id="newsScheduleLabel">Every morning · Pacific time</small></div></div></div><div class="news-selection-heading"><label for="newsTopicSearch">Your topics</label><span id="newsTopicCount">0 / 5 topics</span></div><div id="newsSelectedTopics" class="news-selected"></div><div class="news-search-row"><span aria-hidden="true">⌕</span><input id="newsTopicSearch" type="search" maxlength="60" placeholder="Search topics — NBA, F1, a team, music…" autocomplete="off" aria-describedby="newsTopicLimit" ${canEdit?'':'disabled'}></div><p id="newsTopicLimit" class="news-hint">Search a league, team, hobby, or any other interest.</p><div id="newsTopicSuggestions" class="news-suggestions"></div><div class="news-save-row"><span id="newsSelectionState" class="news-hint">Loading your topics…</span><div><button id="newsResetTopics" class="button subtle" type="button" disabled>Reload topics</button><button id="newsSaveTopics" class="button gold" type="button" disabled>Save topics</button></div></div>${canEdit?'':'<p class="news-hint">Sign in as the owner to change the topics in this dashboard. You can still browse and filter the articles.</p>'}<p id="newsStatus" class="news-status" role="status" aria-live="polite"></p></section><div class="news-feed-toolbar"><div id="newsFilters" class="news-filters" aria-label="Filter news by topic"></div><div class="news-article-tools"><label class="news-article-search"><span class="sr">Search saved news articles</span><input id="newsArticleSearch" type="search" placeholder="Search articles…"></label><button type="button" class="button subtle" id="newsReload">Reload articles</button></div></div><div id="newsCards" class="news-cards" aria-label="News briefings"><div class="pd-panel news-empty">Loading your news…</div></div>`;
 el('newsTopicSearch').addEventListener('input',renderSuggestions);
 el('newsArticleSearch').addEventListener('input',event=>{articleQuery=event.target.value;renderFeed();});
 el('newsSaveTopics').addEventListener('click',saveTopics);
 el('newsResetTopics').addEventListener('click',()=>{if(busy)return;void loadNews({force:true,discardDraft:true});});
 el('newsReload').addEventListener('click',()=>void loadNews({force:true}));
 root().addEventListener('click',event=>{
  const filter=event.target.closest('[data-news-filter]');if(filter){topicFilter=filter.dataset.newsFilter;renderFeed();return;}
  if(!canEdit||busy||!saved)return;
  const add=event.target.closest('[data-add-topic]'),remove=event.target.closest('[data-remove-topic]');
  if(add){try{const topic=newsTopic(add.dataset.addTopic);if(draft.length>=MAX_NEWS_TOPICS||draft.some(t=>t.id===topic.id))return;draft.push(topic);el('newsTopicSearch').value='';}catch(error){say(error.message,true);return;}}
  else if(remove)draft=draft.filter(t=>t.id!==remove.dataset.removeTopic);else return;
  loadGeneration++;dirty=!sameTopics(draft,saved.topics);renderSelections();say(dirty?'Save topics to update your morning feed.':'No unsaved changes.');
  el('newsTopicSearch').focus();
 });
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 window.addEventListener('focus',()=>void loadNews());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void loadNews();});
 setInterval(()=>void loadNews(),60000);
 void loadNews({force:true});
}
