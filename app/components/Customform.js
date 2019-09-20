import React, { Component } from 'react';
import style from './CustomForm.css';
import ExtractedContent from './ExtractedContent';
import Popup from './Popup';
import * as APIDATA from '../constants/apidata';
import logo from '../../chrome/assets/img/logo-small.png';
import * as INSTANCE from '../constants/config.json';

const urlExists = require('url-exists');

export default class Customform extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
      summary: '',
      message: '',
      image: '',
      categories: [],
      selectedCat: '',
      multiSelect: [],
      optionClicked: [],
      url: '',
      cleanUrl: '',
      allImages: [],
      showPopup: false,
      selectedImage: -1,
      showEdit: true,
      showShare: false,
      showAttachmentTab: false,
      showImgTab: false,
      showMsgTab: false,
      showNotificationTab: false,
      showJsonTree: false,
      showSettings: false,
      ogData: [],
      metaData: [],
      taskId: '',
      siteUrl: '',
      isLogin: true,
      metaDataJSON: '',
      loader: false,
      fetchingContents: true,
      apiKey: '',
      messageApiKey: '',
      extLocalConfigName: '',
      baseUrl: '',
      cookie: '',
      duplicateMessage: '',
      parentId: null,
      favIcon: null,
      extConfig: [],
      contentType: [],
      contentTypeSelected:'',
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleSummary = this.handleSummary.bind(this);
    this.handleUrl = this.handleUrl.bind(this);
    this.activateTabs = this.activateTabs.bind(this);
    this.saveSetting = this.saveSetting.bind(this);
    this.authenticate = this.authenticate.bind(this);
    this.signinTab = this.signinTab.bind(this);
    this.checkURL = this.checkURL.bind(this);
    this.getCookies = this.getCookies.bind(this);
  }
  componentDidMount() {
    this.authenticate();  
    
    if (this.state.isLogin) {
      this.getExtLocalConfig();
    }

    let selectedContent = '';
    chrome.tabs.executeScript({
      code: 'window.getSelection().toString();'
    }, (selection) => {
      if (selection[0]) {
        selectedContent = selection[0];
      }
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabUrl = tabs[0].url;
      this.setState({ url: tabUrl, cleanUrl: this.generateCleanURL(tabUrl) });

      const x = new XMLHttpRequest();
      x.open('GET', tabUrl);
      x.responseType = 'document';
      x.onload = (e) => {
        e.preventDefault();
        const doc = x.response;
        if (doc) {
          let title = doc.querySelector('meta[property="og:title"]');
          let desc = doc.querySelector('meta[property="og:description"]');
          let image = doc.querySelector('meta[property="og:image"]');
          let dcTitle = doc.querySelector('meta[name="DC.Title"]');
          title = title ? title : dcTitle;
          const ogData = [];
          const og = doc.querySelectorAll("meta[property^='og']");
          let favicon;
          const nodeList = doc.querySelectorAll('link');
          for (let i = 0; i < nodeList.length; i++) {
            if ((nodeList[i].getAttribute('rel') === 'icon') || (nodeList[i].getAttribute('rel') === 'shortcut icon')) {
              favicon = nodeList[i].getAttribute('href');
            }
          }
          let i = 0;
          for (i = 0; i < og.length; i++) {
            ogData.push({ name: og[i].attributes.property.nodeValue, content: og[i].attributes.content.nodeValue });
          }
          this.setState({ ogData });
          const metaDataOb = [];
          const meta = doc.getElementsByTagName('meta');
          let j = 0;
          for (j = 0; j < meta.length; j++) {
            if (meta.item(j).name != '') {
              metaDataOb.push({ name: meta.item(j).name, content: meta.item(j).content });
            }
          }
          this.setState({ metaData: metaDataOb });
          this.generateJSON(doc);
          if (x.readyState === 4) {
            if (x.status === 200) {
              this.findDuplicate();
              let baseUrl = this.state.url.split('/');
              let readMoreurl = `${baseUrl[2]}`;
              readMoreurl = readMoreurl.replace('www.', '');
              const readMore = "\n\n[Read on " + readMoreurl + "]\n(" + this.state.cleanUrl + ")";
              const pattern = /^((http|https|www):\/\/)/;
              if (desc && selectedContent === '') {
                desc = desc.getAttribute('content');
                desc = desc + readMore;
                this.setState({ summary: desc });
              } else {
                if (selectedContent !== '') {
                  selectedContent = selectedContent + readMore;
                }
                this.setState({ summary: selectedContent });
              }
              if (title) {
                title = title.getAttribute('content');
                title = title.split(/[»|\-\-]/);
                title = title[0];
                this.setState({ value: title });
              }
              if (image) {
                image = image.getAttribute('content');
                if (!pattern.test(image)) {
                  baseUrl = baseUrl[0] + "//" + baseUrl[2];
                  image = baseUrl + image;
                }
                this.setState({ image });
              }
              if (favicon) {
                if (favicon.startsWith('//')) {
                  favicon = baseUrl[0] + favicon;
                } else if (!pattern.test(favicon)) {
                  baseUrl = `${baseUrl[0]}//${baseUrl[2]}`;
                  favicon = baseUrl + favicon;
                }
                const self = this;
                urlExists(favicon, function (err, exists) {
                  if (exists) {
                    self.setState({ favIcon: favicon });
                  }
                });
              }
            } else {
              this.setState({ fetchingContents: false });
            }
          }
          const images = doc.getElementsByTagName('img');
          const srcList = [];
          if (image) {
            srcList.push(image);
          }
          for (let i = 0; i < images.length; i++) {
            const img = images[i].src;
            const res = img.match(/ajax|email|icon|FB|social|small|facebook|logo/gi);
            if ((res == null) && (srcList.indexOf(img) === -1)) {
              const validUrl = this.checkURL(img);
              if (validUrl) {
                srcList.push(img);
              }
            }
          }
          this.setState({ allImages: srcList });
        } else {
          this.setState({ fetchingContents: false });
        }
      };
      x.onerror = (e) => {
        throw e;
      };
      x.send(null);
    });
  }
  checkURL(url) {
    return (url.match(/\.(jpeg|jpg|gif|png)$/) != null);
  }
  findDuplicate() {
    const cleanUrl = this.state.cleanUrl;
    const filterParam = `filters=[{"${APIDATA.cleanUrlField}":{"operator":"~","values":["${encodeURI(cleanUrl)}"]}},{"${APIDATA.sourceUrlField}":{"operator":"~","values":["${encodeURI(this.state.url)}"]}}]`;
    const filterData = {
      method: 'GET',
      credentials: 'include',
      headers: {
        // Authorization: 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/projects/${APIDATA.PROJECT_ID}/work_packages/?${filterParam}`, filterData)
      .then((response) => response.json()).then((responseData) => {
        this.setState({ fetchingContents: false });
        if (typeof (responseData._embedded) !== 'undefined') {
          const duplicateElements = responseData._embedded.elements;
          if (duplicateElements.length > 0) {
            const lowest = duplicateElements[0].id;
            const openProjectCleanUrl = duplicateElements[0][APIDATA.cleanUrlField];
            let duplicateMsg = '';
            if (openProjectCleanUrl === cleanUrl) {
              duplicateMsg = `Clean URL duplicate of # ${lowest}`;
            } else {
              duplicateMsg = `Source URL duplicate of # ${lowest}`;
            }
            this.setState({ parentId: lowest, duplicateMessage: duplicateMsg });
          }
        }
      });
  }
  handleChange(event) {
    this.setState({ value: event.target.value });
  }
  handleUrl(event) {
    this.setState({ cleanUrl: event.target.value });
  }
  handleSummary(event) {
    this.setState({ summary: event.target.value });
  }
  handleContentType(event){
    this.setState({ contentTypeSelected: event.target.value });
  }
  handleApikey = (e) => {
    this.setState({ apiKey: e.target.value });
  }
  handleBaseUrl = (e) => {
    this.setState({ baseUrl: e.target.value });
  }
  saveSetting(event) {
    event.preventDefault();

    const authdata = {
      method: 'GET',
      credentials: 'include',
      headers: {
        // 'Authorization': 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/my_preferences/`, authdata)
      .then((response) => {
        if (response.status === 200) {
          const obj = {};
          obj.apiKey = this.state.apiKey;
          obj.baseUrl = this.state.baseUrl;
          chrome.storage.local.set(obj);
          this.setState({ messageApiKey: 'ApiKey Saved Successfully.' });
          this.setState({ messageApiKeyErr: '' });
        } else {
          this.setState({ messageApiKeyErr: 'Invalid API Key.' });
          this.setState({ messageApiKey: '' });
        }
        return response.json();
      }).catch((response) => {
        this.setState({ messageApiKeyErr: 'Invalid API Key / Base Url.' });
        this.setState({ messageApiKey: '' });
      });
  }
  togglePopup() {
    this.setState({
      showPopup: !this.state.showPopup
    });
  }

  handleChangeValue = (e) => {
    this.setState({ showPopup: e.target.value });
    this.setState({ selectedImage: e.target.alt });
    this.setState({ image: this.state.allImages[Number(e.target.alt)] });
  }
  signinTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      this.url = tabs[0].url;
      if (this.url.indexOf(APIDATA.BASE_URL) === -1) {
        chrome.tabs.create({ url: APIDATA.BASE_URL }, () => { });
      }
    });
  }
  setConfigVal = () => new Promise(((resolve) => {
    Object.keys(INSTANCE).forEach((key) => {
      // eslint-disable-next-line no-console
      if (key === APIDATA.DOMAIN_NAME) {
        const obj = {};
        obj.config = INSTANCE[key];
        chrome.storage.local.set(obj);
      }
    });

    chrome.storage.local.get('config', async (items) => {
      resolve(items.config);
    });
  }));

  getExtLocalConfig = async () => {
    const config = await this.setConfigVal();
    this.setState({ extLocalConfigName: config.projects.dynamicConfig.extnLocalConfig });

    
    const jsData = await fetch(`/extLocalConfig/${config.projects.dynamicConfig.extnLocalConfig}`).then((response) => {
      return response.json();
    }).then((responsoData) => {
      this.setState({ extConfig: responsoData });  
      this.setState({ contentType: responsoData.contentType[0].workPackage });
      this.setState({ contentTypeSelected: responsoData.contentType[0].workPackage[0].id });
    }).catch((e)=>{
      console.log('Json error',e);
    });

    
  }
  authenticate = () => new Promise((resolve) => {
    const authdata = {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    this.getCookies(APIDATA.BASE_URL, '_open_project_session', (cookies) => {

      chrome.cookies.set({ url: APIDATA.BASE_URL, name: '_open_project_session', value: cookies });
      fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/my_preferences/`, authdata)
        .then((response) => {
          if (response.status === 200) {
            this.setState({ authenticate: true });
          } else {
            this.setState({ isLogin: false });
            this.setState({ showEdit: false });
            this.setState({ showSettings: true });
            this.setState({ authenticate: false });
            chrome.storage.local.clear();
          }
          resolve(response.json());
        }).catch(() => {
          this.setState({ isLogin: false });
          this.setState({ showEdit: false });
          this.setState({ showSettings: true });
          this.setState({ authenticate: false });
          chrome.storage.local.clear();
        });
    });
  });
  handleSubmit(event) {
    event.preventDefault();
    this.setState({ loader: true });
    const params = JSON.stringify({
      subject: this.state.value,
      description: {
        format: 'markdown',
        raw: this.state.summary,
        html: ''
      },
      [APIDATA.sourceUrlField]: encodeURI(this.state.url),
      [APIDATA.cleanUrlField]: encodeURI(this.state.cleanUrl),
      _links: {
        type: {
          href: `/api/v3/types/${this.state.contentTypeSelected}`,
          title: 'Post'
        },
      }
    });
    const data = {
      method: 'POST',
      body: params,
      credentials: 'include',
      headers: {
        // Authorization: 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json;charset=UTF-8',
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/projects/${APIDATA.PROJECT_ID}/work_packages/`, data)
      .then((response) => {
        if (response.status === 201) {
          // this.setState({ message: 'Saved Successfully.' });
        }
        return response.json();
      }).then((catdata) => {
        const webPackageId = catdata.id;
        this.setState({ taskId: webPackageId });
        this.toDataUrl(this.state.image, (myBase64) => {
          const fileName = 'Curated Featured Image.png';
          this.uploadImage(webPackageId, fileName, myBase64);
        });
        this.setState({ siteUrl: APIDATA.SITE_URL });
        this.setState({ message: `Saved in ${APIDATA.DOMAIN_NAME} as` });
        this.setState({ loader: false });
        this.uploadOgData(webPackageId);
        this.uploadMetaData(webPackageId);
        if (this.state.parentId) {
          this.createRelation(webPackageId);
        }
        if (this.state.favIcon) {
          this.toDataUrl(this.state.favIcon, (base64Content) => {
            const fileName = 'Curated Source FavIcon.png';
            this.uploadImage(webPackageId, fileName, base64Content);
          });
        }
      });
  }

  createRelation(webPackageId) {
    const params = JSON.stringify({
      _links:
      {
        from: { href: `/api/v3/work_packages/${this.state.parentId}` },
        to: { href: `/api/v3/work_packages/${webPackageId}` }
      },
      type: 'duplicates',
      description: 'This is the same thing.'
    });
    const data = {
      method: 'POST',
      body: params,
      credentials: 'include',
      headers: {
        // Authorization: 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json;charset=UTF-8',
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/work_packages/${webPackageId}/relations`, data);
  }
  // eslint-disable-next-line camelcase
  // eslint-disable-next-line class-methods-use-this

  generateJSON(doc) {
    const twitterData = [];
    const twitter = doc.querySelectorAll("meta[property^='twitter']");
    let i = 0;
    for (i = 0; i < twitter.length; i++) {
      twitterData.push({ name: twitter[i].attributes.property.nodeValue, content: twitter[i].attributes.content.nodeValue });
    }
    const metaData = [];
    metaData.push({ name: 'Curated OpenGraph', content: this.state.ogData });
    metaData.push({ name: 'Curated Twitter', content: twitterData });
    metaData.push({ name: 'Curated Meta Data', content: this.state.metaData });
    const databody = JSON.stringify(metaData);
    this.setState({ metaDataJSON: databody });
  }

  generateCleanURL(url) {
    this.cleanUrl = url.replace(/(\?)utm[^&]*(?:&utm[^&]*)*&(?=(?!utm[^\s&=]*=)[^\s&=]+=)|\?utm[^&]*(?:&utm[^&]*)*$|&utm[^&]*/gi, '$1');
    return this.cleanUrl;
  }

  toDataUrl = (url, callback) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        callback(this.response);
        const img = document.getElementById('img');
        if (img) {
          const urlObj = window.URL || window.webkitURL;
          img.src = urlObj.createObjectURL(this.response);
        }
      }
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
  }

  uploadImage(id, fileName, data) {
    const databody = JSON.stringify({ 'fileName': fileName, description: { 'raw': 'A cute kitty, cuddling with its friends!' } });
    this.formBody = new FormData();
    this.formBody.append('metadata', databody);
    this.formBody.append('file', data, 'opengraph-logo.72382e605ce3.png');
    const authdata = {
      method: 'POST',
      body: this.formBody,
      credentials: 'include',
      headers: {
        // 'Authorization': 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/work_packages/${id}/attachments`, authdata);
  }
  uploadOgData(id) {
    const ogFile = new Blob([JSON.stringify(this.state.ogData)], { type: 'application/json' });
    const fr = new FileReader();
    fr.readAsText(ogFile);
    const databody = JSON.stringify({ fileName: 'Curated OpenGraph.json', description: { raw: 'A cute kitty, cuddling with its friends!' } });
    const formBody = new FormData();
    formBody.append('metadata', databody);
    formBody.append('file', ogFile, 'ogData.json');
    const authdata = {
      method: 'POST',
      body: formBody,
      credentials: 'include',
      headers: {
        // 'Authorization': 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/work_packages/${id}/attachments`, authdata);
  }
  uploadMetaData(id) {
    const ogFile = new Blob([JSON.stringify(this.state.metaData)], { type: 'application/json' });
    const fr = new FileReader();
    fr.readAsText(ogFile);
    const databody = JSON.stringify({ fileName: 'Curated MetaData.json', description: { raw: 'A cute kitty, cuddling with its friends!' } });
    const formBody = new FormData();
    formBody.append('metadata', databody);
    formBody.append('file', ogFile, 'ogData.json');
    const authdata = {
      method: 'POST',
      body: formBody,
      credentials: 'include',
      headers: {
        // 'Authorization': 'Basic ' + btoa('apikey:' + this.state.apiKey),
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    fetch(`${APIDATA.BASE_URL + APIDATA.API_URL}/work_packages/${id}/attachments`, authdata);
  }
  activateTabs(event) {
    event.preventDefault();
    let editTab = false;
    let shareTab = false;
    let attachmentTab = false;
    let imgTab = false;
    let msgTab = false;
    let notificationTab = false;
    let jsonTreeTab = false;
    let showSettingsTab = false;
    if (String(event.target.id) === 'editTab') {
      editTab = true;
    } else if (String(event.target.id) === 'shareTab') {
      shareTab = true;
    } else if (String(event.target.id) === 'attachmentTab') {
      attachmentTab = true;
    } else if (String(event.target.id) === 'imgTab') {
      imgTab = true;
    } else if (String(event.target.id) === 'msgTab') {
      msgTab = true;
    } else if (String(event.target.id) === 'notificationTab') {
      notificationTab = true;
    } else if (String(event.target.id) === 'jsonTree') {
      jsonTreeTab = true;
    } else if (String(event.target.id) === 'settingsTab') {
      showSettingsTab = true;
    }
    this.setState({
      showEdit: editTab,
      showShare: shareTab,
      showAttachmentTab: attachmentTab,
      showImgTab: imgTab,
      showMsgTab: msgTab,
      showNotificationTab: notificationTab,
      showJsonTree: jsonTreeTab,
      showSettings: showSettingsTab
    });
  }
  getCookies(domain, name, callback) {
    chrome.cookies.get({ url: domain, name: name }, (cookie) => {
      if (callback) {
        if (cookie) {
          this.coockieValue = cookie.value;
          callback(this.coockieValue);
        } else {
          callback(null);
        }
      }
    });
  }
  render() {
    return (
      <section className={style.sectionContent}>
        {this.state.isLogin ? <div className="ds-l-container">
          <div className="ds-l-row">
            <div className="ds-u-padding--0 ds-l-col--11">
              {this.state.showEdit ?
                <div id="panel-edit">
                  <form onSubmit={this.handleSubmit}>
                    <p>
                      <textarea className={[style.textareaTitle, 'preview__label ds-u-font-size--h4 ds-u-font-style--normal'].join(' ')} value={this.state.value} onChange={this.handleChange} />
                    </p>
                    <hr className="on ds-u-fill--gray-lightest" />
                    {this.state.fetchingContents ? <p className="ds-u-text-align--center">
                      <button className="ds-c-button">
                        <span className="ds-c-spinner ds-c-spinner--small" aria-valuetext="Fetching Contents" role="progressbar" /> Fetching Contents
                      </button>
                    </p> : null}
                    <p>
                      <label>
                        <textarea className={[style.textareaDesc, 'preview__label ds-u-font-size--small ds-u-font-style--normal'].join(' ')} value={this.state.summary} onChange={this.handleSummary} />
                      </label>
                    </p>

                    <p className={style.ogImageContainer}>
                      {this.state.image.length > 0 ?
                        <img id="imgTab" onClick={this.activateTabs} src={this.state.image} className={style.ogImages} alt="" />
                        : null}
                    </p>
                    <hr className="on ds-u-fill--gray-lightest" />
                    {this.state.fetchingContents ? null : <div className="ds-l-row ds-u-margin-left--0">
                      <div className={[style.favIcon, 'ds-l-col--auto'].join(' ')}>{this.state.favIcon ? <img src={this.state.favIcon} width="18px" height="18px" alt="favIcon" /> : null}</div>
                      <div className={[style.cleanUrl, 'ds-l-col--10 ds-u-padding-x--0'].join(' ')}><input type="text" className={this.state.parentId ? [style.textareaLink, 'preview__label ds-u-font-style--normal ds-u-color--white on ds-u-fill--secondary-dark ds-u-padding-x--1'].join(' ') : [style.textareaLink, 'preview__label ds-u-font-style--normal'].join(' ')} value={this.state.cleanUrl} onChange={this.handleUrl} style={this.state.parentId ? { height: '20px' } : { height: '18px' }} /></div>
                    </div>}
                    <hr className="on ds-u-fill--gray-lightest ds-u-margin-bottom--0" />
                    {this.state.fetchingContents ? null : <div className="ds-l-row"><div className="ds-l-col--11"><select className="ds-c-field ds-u-font-size--small ds-u-font-style--normal ds-u-border--1 ds-u-margin-x--1 ds-u-margin-bottom--0" value={this.state.contentTypeSelected} onChange={e => this.setState({ contentTypeSelected: e.target.value })}>
                      {this.state.contentType.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select></div></div>
                    }


                    <hr className="on ds-u-fill--gray-lightest ds-u-margin-bottom--0" />
                    {this.state.fetchingContents ? null : <div className={style.sucessBlock}>
                      {this.state.loader ? <button className="ds-u-margin-left--1 ds-u-margin-top--1 ds-c-button ds-c-button--primary">
                        <span className="ds-c-spinner ds-c-spinner--small ds-c-spinner--inverse" aria-valuetext="Saving" role="progressbar" /> Saving
                      </button> : null}
                      {this.state.message === '' && this.state.loader === false ?
                        <div className="ds-l-row">
                          <div className="ds-l-col--auto">
                            <input type="submit" value="Post to Lectio" className="ds-u-margin-left--1 ds-u-margin-top--1 ds-c-button ds-c-button--primary" /></div>
                          <div className="ds-l-col--auto">
                            {this.state.parentId ? <a className="ds-u-margin-top--1 preview__label ds-u-font-size--base ds-u-font-style--normal" target="_blank" href={`${APIDATA.BASE_URL + APIDATA.SITE_URL + this.state.parentId}/activity`}>{this.state.duplicateMessage}</a> : null}</div>
                        </div> : null}
                      {this.state.message !== '' ?
                        <div className="ds-c-alert ds-c-alert--success">
                          <div className="ds-c-alert__body">
                            <p className="ds-c-alert__text">{this.state.message} <a target="_blank" href={APIDATA.BASE_URL + APIDATA.SITE_URL + this.state.taskId} rel="noopener noreferrer">{this.state.taskId ? '#' + this.state.taskId : null}</a></p>
                          </div>
                        </div> : null}
                    </div>}

                  </form>
                </div>
                : null}
              {this.state.showJsonTree ? <div id="panel-meta">
                <div className="usa-accordion site-accordion-code">
                  <h4 className="usa-accordion__heading site-accordion-code">
                    <button
                      className="usa-accordion__button"
                      aria-expanded="true"
                      aria-controls="metaDataContent"
                    >
                      Extracted meta data
                    </button>
                  </h4>
                  <div id="metaDataContent" className="usa-accordion__content usa-prose">
                    <ExtractedContent jsonData={this.state.metaDataJSON} />
                  </div>
                </div>

              </div> : null}
              {this.state.showShare ? <div id="panel-share"><p className="ds-u-text-align--center ds-u-font-size--h3">Coming Soon !!</p></div> : null}
              {this.state.showAttachmentTab ? <div id="panel-attachment"><p className="ds-u-text-align--center ds-u-font-size--h3">Coming Soon !!</p></div> : null}
              {this.state.showImgTab ? <div id="panel-img"><Popup
                text="Close"
                closePopup={this.togglePopup.bind(this)}
                images={this.state.allImages}
                selectedImage={this.state.allImages}
                onChangeValue={this.handleChangeValue}
              />
              </div> : null}
              {this.state.showMsgTab ? <div id="panel-msg"><p className="ds-u-text-align--center ds-u-font-size--h3">Coming Soon !!</p></div> : null}
              {this.state.showNotificationTab ? <div id="panel-notification"><p className="ds-u-text-align--center ds-u-font-size--h3">Coming Soon !!</p></div> : null}
              {this.state.showSettings ? <div id="panel-notification">
                <p className="ds-u-text-align--center ds-u-font-size--h3">Coming Soon !!</p>
              </div> : null}
            </div>
            <div className={[style.sideBar, 'ds-u-padding--0 ds-l-col--1 ds-u-border-left--1'].join(' ')}>
              <div>
                <div>
                  <ul className={[style.verticalNavCustom, 'ds-c-vertical-nav'].join(' ')}>
                    <li className={this.state.showEdit ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showEdit ? [style.editActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.editInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="editTab" />
                    </li>
                    <li className={this.state.showJsonTree ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showJsonTree ? [style.metaActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.metaInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="jsonTree" />
                    </li>
                    <li className={this.state.showImgTab ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showImgTab ? [style.imgActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.imgInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="imgTab" />
                    </li>
                    <li className={this.state.showShare ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showShare ? [style.shareActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.shareInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="shareTab" />
                    </li>
                    <li className={this.state.showNotificationTab ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showNotificationTab ? [style.notificationActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.notificationInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="notificationTab" />
                    </li>
                    <li className={this.state.showAttachmentTab ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showAttachmentTab ? [style.attachmentActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.attachmentInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="attachmentTab" />
                    </li>
                    <li className={this.state.showMsgTab ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showMsgTab ? [style.messageActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.messageInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="msgTab" />
                    </li>
                    <li className={this.state.showSettings ? [style.verticalNavCustomActive, 'ds-c-vertical-nav__item'].join(' ') : 'ds-c-vertical-nav__item'} onClick={this.activateTabs}>
                      <a className={this.state.showSettings ? [style.settingsActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ') : [style.settingsInActive, style.sidebarIcons, 'ds-c-vertical-nav__label ds-u-padding--0'].join(' ')} href="#" id="settingsTab" />
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div> : <div>
            <div>
              <img id="logoIcon" className={style.logoSmall} src={logo} alt="Lectio" />
            </div>
            <div className="ds-u-font-size--h3 ds-u-text-align--center ds-u-margin-bottom--3">
              You are not authenticated yet, <br />please log in to continue.
          </div>
            <hr className="on ds-u-fill--gray-lightest" />
            <div className="ds-u-text-align--center ds-u-margin-top--4">
              <div claasName="ds-u-margin-top--4"><a className="ds-c-button ds-c-button--primary" onClick={this.signinTab} >Sign in</a></div>
              <div className="ds-u-font-style--italic ds-u-margin-top--4 ds-u-margin-bottom--2">
                After you’ve signed in, <br />please click the extension button again.
            </div>
            </div>
          </div>}
      </section>
    );
  }
}

