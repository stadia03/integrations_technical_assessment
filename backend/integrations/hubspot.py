# hubspot.py

from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse
import httpx
import urllib.parse
import secrets
import json
import asyncio
import requests
from dotenv import dotenv_values
from redis_client import add_key_value_redis,get_value_redis,delete_key_redis

from integrations.integration_item import IntegrationItem

config= dotenv_values(".env")

CLIENT_ID = config['HUBSPOT_CLIENT_ID']
CLIENT_SECRET = config['HUBSPOT_CLIENT_SECRET']

SCOPES = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "oauth"
]

scope_param = " ".join(SCOPES)
REDIRECT_URI = 'http://localhost:8000/integrations/hubspot/oauth2callback'




async def authorize_hubspot(user_id, org_id):
    state_data = {
        'state' : secrets.token_urlsafe(32),
        'user_id': user_id,
        'org_id': org_id
    }
    encoded_state= json.dumps(state_data)

    params= {
    "client_id": CLIENT_ID,
    "scope": scope_param,
    "redirect_uri": REDIRECT_URI,
    "state": state_data,
    }
    base_url = "https://app.hubspot.com/oauth/authorize"
    auth_url = f"{base_url}?{urllib.parse.urlencode(params)}"   

    await add_key_value_redis(f'hubspot_state:{org_id}:{user_id}',encoded_state,600)

    return auth_url

    
async def oauth2callback_hubspot(request: Request):
    query_params = request.query_params
    code = query_params.get("code")
    state = query_params.get("state")

    if not code or not state:
        raise HTTPException(status_code =400, detail = "Missing code or state parameter.")

    try:
        decoded_state = urllib.parse.unquote(state)

        state_json_ready = decoded_state.replace('+', '').replace("'", '"')
        state_data_dic = json.loads(state_json_ready)

        redis_key = f'hubspot_state:{state_data_dic["org_id"]}:{state_data_dic["user_id"]}'
        stored_state = await get_value_redis(redis_key)

        if not stored_state:
            raise HTTPException(status_code =400, detail='Invalid state or state expired!')
        
        stored_state_dic = json.loads(stored_state)

        if state_data_dic["state"] != stored_state_dic["state"]:
            raise HTTPException(status_code= 400, detail = "State mismatch")
        
        token_data = {
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code": code
        }

        async with httpx.AsyncClient() as client:
            response, _ = await asyncio.gather(
            client.post(
                "https://api.hubapi.com/oauth/v1/token",
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
                ),
                delete_key_redis(redis_key)    
            )
        if response.status_code != 200:
                raise HTTPException( status_code=400, detail=f"Failed to exchange code for tokens: {response.text}")
        
        await add_key_value_redis(f'hubspot_credentials:{state_data_dic["org_id"]}:{state_data_dic["user_id"]}',json.dumps(response.json()),600)
      
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    
    
    close_window_script = """
    <html>
        <script>
            window.close();
        </script>
    </html>
    """

    return HTMLResponse(content=close_window_script)


async def get_hubspot_credentials(user_id, org_id):
    credentials = await get_value_redis(f'hubspot_credentials:{org_id}:{user_id}')
    if not credentials:
        raise HTTPException(status_code=400, detail='No credentials found.')
    credentials = json.loads(credentials)
  
    await delete_key_redis(f'hubspot_credentials:{org_id}:{user_id}')

    return credentials


async def create_integration_item_metadata_object(response_json: dict, object_type: str) -> IntegrationItem:

    item_id = response_json.get('id')
    properties = response_json.get('properties', {})
    created_at_str = response_json.get('createdAt') or properties.get('createdate')
    updated_at_str = response_json.get('updatedAt') or properties.get('hs_lastmodifieddate') or properties.get('lastmodifieddate')


    name = "Unknown"
    email= None
    url = None
    if object_type == 'contacts':
        first_name = properties.get('firstname', '')
        last_name = properties.get('lastname', '')
        email=properties.get('email')
        if first_name or last_name:
            name = f"{first_name} {last_name}".strip()
        else:
          
            name = properties.get('email', 'Unknown')
    elif object_type == 'companies':
        name = properties.get('name') or properties.get('domain') or "Unknown Company"
        url = properties.get('domain')
    elif object_type == 'deals':
        name = properties.get('dealname') or f"Deal {item_id}"
    else:
 
        name = properties.get('name') or f"{object_type.capitalize()} {item_id}"

  

    return IntegrationItem(
        id=str(item_id),
        type=object_type,
        name=name,
        email=email,
        creation_time=created_at_str,
        last_modified_time=updated_at_str,
        url=url,
        directory=False,
        visibility=True
    )

async def get_items_hubspot(credentials, object_type) -> list[IntegrationItem]:
  
    try:
        credentials = json.loads(credentials)
        access_token = credentials.get('access_token')
        if not access_token:
            raise ValueError("Access token missing from credentials")

        url = f"https://api.hubapi.com/crm/v3/objects/{object_type}"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        response = requests.get(url, headers=headers)
        response.raise_for_status()

        data = response.json()
        items = data.get('results', [])
      
        list_of_integration_items = []
        for item in items:
            # print(item)
            integration_item = await create_integration_item_metadata_object(item, object_type)
            list_of_integration_items.append(integration_item)

        return list_of_integration_items

    except requests.exceptions.RequestException as e:
        print(f"Error fetching from HubSpot: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        return []