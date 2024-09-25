import json
import requests
import boto3
from jose import jwt, jwk
from jose.utils import base64url_decode

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb')
table_name = 'User'

# Cognito details
cognito_pool_region = 'ap-south-1'
cognito_pool_id = 'ap-south-1_ut0iVzp9f'
client_id = '3tnr97r3pp977t6kl80cags9e1'
redirect_uri = 'https://www.google.com'
token_endpoint = f'https://system404.auth.ap-south-1.amazoncognito.com/oauth2/token'

# Global variable to hold JWT keys
jwt_keys = None

def fetch_cognito_jwt_keys():
    jwks_url = f'https://cognito-idp.{cognito_pool_region}.amazonaws.com/{cognito_pool_id}/.well-known/jwks.json'
    response = requests.get(jwks_url)
    response.raise_for_status()
    return response.json()['keys']

def decode_jwt(token, jwt_keys):
    try:
        header = jwt.get_unverified_header(token)
        key = next((k for k in jwt_keys if k['kid'] == header['kid']), None)
        if not key:
            raise ValueError('Unable to find appropriate key for JWT verification')

        public_key = jwk.construct(key)
        message, encoded_signature = str(token).rsplit('.', 1)
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))

        if not public_key.verify(message.encode("utf8"), decoded_signature):
            raise ValueError('Signature verification failed')

        payload = jwt.decode(
            token,
            public_key.to_dict(),
            algorithms=['RS256'],
            audience=client_id,
            issuer=f'https://cognito-idp.{cognito_pool_region}.amazonaws.com/{cognito_pool_id}',
            options={'verify_at_hash': False}  # Skip at_hash validation
        )
        return payload
    except Exception as e:
        raise ValueError(f'Error decoding JWT: {str(e)}')

def check_user_exists(username):
    try:
        response = dynamodb.get_item(
            TableName=table_name,
            Key={'username': {'S': username}}
        )
        return 'Item' in response  # If 'Item' is in the response, the user exists
    except Exception as e:
        raise ValueError(f"Error checking user existence: {str(e)}")

def lambda_handler(event, context):
    global jwt_keys
    if jwt_keys is None:
        jwt_keys = fetch_cognito_jwt_keys()

    try:
        if event['httpMethod'] == 'POST':
            body = json.loads(event['body'])
            auth_code = body['code']

            # Prepare data for token exchange request
            data = {
                'grant_type': 'authorization_code',
                'client_id': client_id,
                'redirect_uri': redirect_uri,
                'code': auth_code
            }
            
            # Request tokens from Cognito
            headers = {'Content-Type': 'application/x-www-form-urlencoded'}
            response = requests.post(token_endpoint, data=data, headers=headers)
            response.raise_for_status()
            tokens = response.json()

            id_token = tokens.get('id_token')

            # Decode the ID token
            decoded_token = decode_jwt(id_token, jwt_keys)

            # Extract user information
            username = decoded_token.get('cognito:username')
            email = decoded_token.get('email')
            name = decoded_token.get('name')

            # Check if the user already exists in the DynamoDB table
            if not check_user_exists(username):
                # If the user doesn't exist, store their information
                dynamodb.put_item(
                    TableName=table_name,
                    Item={
                        'username': {'S': username},
                        'email': {'S': email},
                        'name': {'S': name}
                    }
                )

            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
                },
                'body': json.dumps({'message': 'User data processed successfully', 'tokens': tokens})
            }
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
                },
                'body': json.dumps({'message': 'Method not allowed'})
            }

    except requests.exceptions.RequestException as e:
        print("RequestException: " + str(e))
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
            },
            'body': json.dumps({'message': 'Network error: ' + str(e)})
        }
    except Exception as e:
        print("Exception: " + str(e))
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
            },
            'body': json.dumps({'message': str(e)})
        }
