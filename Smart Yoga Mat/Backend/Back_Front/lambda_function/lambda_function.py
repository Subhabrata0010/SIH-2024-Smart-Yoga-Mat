import json
import boto3

# Create a client for the API Gateway WebSocket
apigw_client = boto3.client('apigatewaymanagementapi', endpoint_url='wss://0hrwt85h36.execute-api.ap-south-1.amazonaws.com/prod/')

def lambda_handler(event, context):
    # Extract the IoT message payload
    iot_message = event.get('message', {})
    pressures = iot_message.get('pressures', [])
    colors = iot_message.get('colors', [])
    
    # Prepare the message to be sent to WebSocket clients
    message = {
        "pressures": pressures,
        "colors": colors
    }

    # Get active WebSocket connections from DynamoDB
    connection_ids = get_active_websocket_connections()

    for connection_id in connection_ids:
        try:
            apigw_client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(message)
            )
        except Exception as e:
            print(f"Failed to send message to {connection_id}: {e}")

    return {"statusCode": 200, "body": "Data sent successfully"}

def get_active_websocket_connections():
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('WebSocketConnections')
    
    # Scan the DynamoDB table to get all active connections
    response = table.scan()
    connection_ids = [item['connectionId'] for item in response.get('Items', [])]
    
    return connection_ids
