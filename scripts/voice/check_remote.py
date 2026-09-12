"""Inspect only an explicitly supplied API URL; never scan or upload audio."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def inspect(base_url,api_key=None,timeout=5):
    base=urllib.parse.urlsplit(base_url)
    if base.scheme not in ('http','https') or not base.hostname or base.username or base.password or base.query or base.fragment:
        raise ValueError('Supply an explicit HTTP(S) base URL without credentials, query or fragment')
    if any(c in base_url for c in '\r\n\t'):
        raise ValueError('Invalid base URL')
    # No proxy discovery, redirects or generated hostnames. VPN routing is supplied by Windows.
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    prefix=base.path.rstrip('/')
    model_path=prefix+'/models' if prefix.endswith('/v1') else prefix+'/v1/models'
    schema_path=prefix[:-3]+'/openapi.json' if prefix.endswith('/v1') else prefix+'/openapi.json'
    report={'schemaVersion':1,'baseUrl':urllib.parse.urlunsplit(base),'requests':[],
            'audioUploaded':False,'networkScanned':False,'redirectsFollowed':False,
            'rvcCompatibility':'Unverified. Model listings/chat or transcription endpoints do not establish voice-to-voice conversion.',
            'requiredNext':'An explicit voice-conversion model and streaming audio contract, or a separately authorized RVC service.'}
    for kind,path in [('models',model_path),('schema',schema_path)]:
        url=urllib.parse.urlunsplit((base.scheme,base.netloc,path,'',''))
        headers={'Accept':'application/json','User-Agent':'VModel-Capability-Check/1'}
        if api_key:headers['Authorization']='Bearer '+api_key
        item={'kind':kind,'path':path}
        try:
            with opener.open(urllib.request.Request(url,headers=headers),timeout=timeout) as response:
                raw=response.read(2_000_001);item['status']=response.status
                if len(raw)>2_000_000:raise ValueError('Response exceeds bounded schema size')
                data=json.loads(raw)
                if kind=='models':
                    item['modelIds']=[str(m.get('id',''))[:200] for m in data.get('data',[])[:100] if isinstance(m,dict)]
                else:
                    item['audioOrInferencePaths']=[p for p in data.get('paths',{}) if any(t in p.lower() for t in ['audio','voice','convert','infer','completion'])][:100]
        except urllib.error.HTTPError as error:item.update(status=error.code,error='HTTP request rejected; response body and headers omitted')
        except Exception as error:item.update(error=type(error).__name__+'; no response secrets logged')
        report['requests'].append(item)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',required=True)
    parser.add_argument('--api-key-env',default='VMODEL_VOICE_API_KEY')
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    try:report=inspect(args.base_url,os.environ.get(args.api_key_env))
    except ValueError as error:parser.error(str(error))
    payload=json.dumps(report,indent=2)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(payload,encoding='utf-8')
    print(payload)
