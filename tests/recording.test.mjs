import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferenceRecorder,preferredRecordingType,recordingExtension} from '../recording.mjs';
const audioStream={getAudioTracks:()=>[{}]},silentStream={getAudioTracks:()=>[]};
test('MP4 with AAC is preferred when the recording includes audio',()=>{
  class Recorder{static isTypeSupported(){return true}constructor(s,opts){this.mimeType=opts.mimeType}}
  const result=createReferenceRecorder(audioStream,Recorder);assert.equal(result.extension,'mp4');assert.match(result.mimeType,/mp4a\.40\.2/);
});
test('video-only recording does not require an audio encoder',()=>{
  class Recorder{static isTypeSupported(type){return type==='video/mp4;codecs=avc1'}constructor(s,opts){this.mimeType=opts.mimeType}}
  assert.equal(createReferenceRecorder(silentStream,Recorder).extension,'mp4');
});
test('unavailable MP4 encoder falls back to an actual WebM container and extension',()=>{
  class Recorder{static isTypeSupported(){return true}constructor(s,opts){if(opts.mimeType.startsWith('video/mp4'))throw Error('No encoder');this.mimeType=opts.mimeType}}
  const result=createReferenceRecorder(audioStream,Recorder);assert.equal(result.extension,'webm');assert.match(result.mimeType,/^video\/webm/);
});
test('uses the actual output MIME rather than giving WebM an MP4 filename',()=>{
  class Recorder{static isTypeSupported(){return true}constructor(){this.mimeType='video/webm'}}
  assert.equal(createReferenceRecorder(audioStream,Recorder).extension,'webm');assert.throws(()=>recordingExtension('video/unknown'),/Unsupported/);
});
test('unsupported browsers report capability without making a recorder',()=>{
  class Recorder{static isTypeSupported(){return false}constructor(){assert.fail('must not construct unsupported encoder')}}
  assert.equal(preferredRecordingType(true,Recorder),null);assert.throws(()=>createReferenceRecorder(audioStream,Recorder),/could not start/);
});
