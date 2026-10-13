// Prefer the broadly compatible H.264/AAC MP4 combination, then native WebM.
export function recordingTypes(hasAudio){
  return hasAudio?
    ['video/mp4;codecs=avc1.42001E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']:
    ['video/mp4;codecs=avc1.42001E','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
}
export function recordingExtension(mimeType){
  if(mimeType.split(';')[0].trim().toLowerCase()==='video/mp4')return 'mp4';
  if(mimeType.split(';')[0].trim().toLowerCase()==='video/webm')return 'webm';
  throw Error('Unsupported recording container.');
}
export function preferredRecordingType(hasAudio,Recorder=globalThis.MediaRecorder){
  if(!Recorder)return null;
  return recordingTypes(hasAudio).find(type=>Recorder.isTypeSupported(type))||null;
}
export function createReferenceRecorder(stream,Recorder=globalThis.MediaRecorder){
  if(!Recorder)throw Error('Recording is unavailable in this browser.');
  const hasAudio=stream.getAudioTracks().length>0;
  for(const type of recordingTypes(hasAudio)){
    if(!Recorder.isTypeSupported(type))continue;
    try{
      const recorder=new Recorder(stream,{mimeType:type,videoBitsPerSecond:12000000});
      const mimeType=recorder.mimeType||type;
      return {recorder,mimeType,extension:recordingExtension(mimeType)};
    }catch(error){ /* A supported encoder can still fail on this device. Try the next format. */ }
  }
  throw Error('This browser could not start an MP4 or WebM encoder.');
}
