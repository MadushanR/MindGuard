"""Generate the reviewable access/registry foundation; does not call AWS."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
ACCOUNT = '950801850836'
REGION = 'ca-central-1'
PREFIX = f'arn:aws:'
tags = [{'Key': 'Project', 'Value': 'MindGuard'}]
template = {
    'AWSTemplateFormatVersion': '2010-09-09',
    'Description': 'MindGuard voice foundation: real identity, consent metadata, image registry and empty provider-secret slot. EKS is a separate deployment stage.',
    'Resources': {
        'VoiceUsers': {
            'Type': 'AWS::Cognito::UserPool', 'DeletionPolicy': 'Retain', 'UpdateReplacePolicy': 'Retain',
            'Properties': {'UserPoolName': 'mindguard-voice-users', 'UsernameAttributes': ['email'],
                'AutoVerifiedAttributes': ['email'], 'AdminCreateUserConfig': {'AllowAdminCreateUserOnly': True},
                'MfaConfiguration': 'OFF', 'Policies': {'PasswordPolicy': {'MinimumLength': 12,
                    'RequireUppercase': True, 'RequireLowercase': True, 'RequireNumbers': True,
                    'RequireSymbols': True, 'TemporaryPasswordValidityDays': 1}},
                'UserPoolTags': {'Project': 'MindGuard'}}},
        'VoiceClient': {'Type': 'AWS::Cognito::UserPoolClient', 'Properties': {
            'UserPoolId': {'Ref': 'VoiceUsers'}, 'ClientName': 'mindguard-voice-client', 'GenerateSecret': False,
            'ExplicitAuthFlows': ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
            'PreventUserExistenceErrors': 'ENABLED', 'EnableTokenRevocation': True,
            'AccessTokenValidity': 15, 'IdTokenValidity': 15, 'RefreshTokenValidity': 1,
            'TokenValidityUnits': {'AccessToken': 'minutes', 'IdToken': 'minutes', 'RefreshToken': 'days'}}},
        'VoiceAccess': {'Type': 'AWS::DynamoDB::Table', 'DeletionPolicy': 'Retain', 'UpdateReplacePolicy': 'Retain',
            'Properties': {'TableName': 'mindguard-voice-access', 'BillingMode': 'PAY_PER_REQUEST',
                'AttributeDefinitions': [{'AttributeName': k, 'AttributeType': 'S'} for k in ['pk', 'sk']],
                'KeySchema': [{'AttributeName': 'pk', 'KeyType': 'HASH'}, {'AttributeName': 'sk', 'KeyType': 'RANGE'}],
                'SSESpecification': {'SSEEnabled': True}, 'TimeToLiveSpecification': {'AttributeName': 'expiresAt', 'Enabled': True}, 'Tags': tags}},
        'VoiceImages': {'Type': 'AWS::ECR::Repository', 'DeletionPolicy': 'Retain', 'UpdateReplacePolicy': 'Retain',
            'Properties': {'RepositoryName': 'mindguard-voice-relay', 'ImageTagMutability': 'IMMUTABLE',
                'ImageScanningConfiguration': {'ScanOnPush': True}, 'Tags': tags}},
        'VoiceProviderSecret': {'Type': 'AWS::SecretsManager::Secret', 'DeletionPolicy': 'Retain', 'UpdateReplacePolicy': 'Retain',
            'Properties': {'Name': 'mindguard/voice/openai', 'Description': 'Set the real API key from the ignored local environment after deployment.',
                'SecretString': '{"OPENAI_API_KEY":""}', 'Tags': tags}},
    },
    'Outputs': {
        'CognitoIssuer': {'Value': {'Fn::Sub': 'https://cognito-idp.${AWS::Region}.amazonaws.com/${VoiceUsers}'}},
        'CognitoUserPoolId': {'Value': {'Ref': 'VoiceUsers'}},
        'CognitoClientId': {'Value': {'Ref': 'VoiceClient'}},
        'VoiceTable': {'Value': {'Ref': 'VoiceAccess'}},
        'VoiceRepositoryUri': {'Value': {'Fn::GetAtt': ['VoiceImages', 'RepositoryUri']}},
        'VoiceSecretArn': {'Value': {'Ref': 'VoiceProviderSecret'}},
    },
}

def statement(sid, actions, resources, condition=None):
    result = {'Sid': sid, 'Effect': 'Allow', 'Action': actions, 'Resource': resources}
    if condition: result['Condition'] = condition
    return result

regional = {'StringEquals': {'aws:RequestedRegion': REGION}}
policy = {'Version': '2012-10-17', 'Statement': [
    statement('MindGuardFoundationStacks', ['cloudformation:CreateStack', 'cloudformation:UpdateStack',
        'cloudformation:DeleteStack', 'cloudformation:DescribeStacks', 'cloudformation:DescribeStackEvents',
        'cloudformation:DescribeStackResources', 'cloudformation:GetTemplate', 'cloudformation:GetStackPolicy'],
        f'arn:aws:cloudformation:{REGION}:{ACCOUNT}:stack/mindguard-voice-foundation/*'),
    statement('ValidateTemplates', ['cloudformation:ValidateTemplate'], '*', regional),
    statement('CreateTaggedVoicePool', ['cognito-idp:CreateUserPool'], '*',
        {'StringEquals': {'aws:RequestedRegion': REGION, 'aws:RequestTag/Project': 'MindGuard'}}),
    statement('ManageTaggedVoicePool', ['cognito-idp:DescribeUserPool', 'cognito-idp:UpdateUserPool',
        'cognito-idp:DeleteUserPool', 'cognito-idp:CreateUserPoolClient', 'cognito-idp:DescribeUserPoolClient',
        'cognito-idp:UpdateUserPoolClient', 'cognito-idp:DeleteUserPoolClient', 'cognito-idp:ListUserPoolClients',
        'cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword', 'cognito-idp:AdminGetUser',
        'cognito-idp:ListTagsForResource', 'cognito-idp:TagResource', 'cognito-idp:UntagResource'],
        f'arn:aws:cognito-idp:{REGION}:{ACCOUNT}:userpool/*',
        {'StringEquals': {'aws:ResourceTag/Project': 'MindGuard'}}),
    statement('VoiceConsentTable', ['dynamodb:CreateTable', 'dynamodb:DescribeTable', 'dynamodb:UpdateTable',
        'dynamodb:DeleteTable', 'dynamodb:DescribeTimeToLive', 'dynamodb:UpdateTimeToLive',
        'dynamodb:ListTagsOfResource', 'dynamodb:TagResource', 'dynamodb:UntagResource',
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        f'arn:aws:dynamodb:{REGION}:{ACCOUNT}:table/mindguard-voice-access'),
    statement('VoiceImageRepository', ['ecr:CreateRepository', 'ecr:DescribeRepositories', 'ecr:DeleteRepository',
        'ecr:PutImageScanningConfiguration', 'ecr:PutImageTagMutability', 'ecr:ListTagsForResource',
        'ecr:TagResource', 'ecr:UntagResource', 'ecr:BatchCheckLayerAvailability', 'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart', 'ecr:CompleteLayerUpload', 'ecr:PutImage', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
        f'arn:aws:ecr:{REGION}:{ACCOUNT}:repository/mindguard-voice-relay'),
    statement('ImageRegistryAuthentication', ['ecr:GetAuthorizationToken'], '*', regional),
    statement('VoiceSecretSlot', ['secretsmanager:CreateSecret', 'secretsmanager:DescribeSecret',
        'secretsmanager:PutSecretValue', 'secretsmanager:UpdateSecret', 'secretsmanager:DeleteSecret',
        'secretsmanager:TagResource', 'secretsmanager:UntagResource'],
        f'arn:aws:secretsmanager:{REGION}:{ACCOUNT}:secret:mindguard/voice/openai-*'),
    statement('InspectEksForNextDeploymentStage', ['eks:ListClusters', 'eks:DescribeClusterVersions'], '*', regional),
]}

for filename, value in [('voice-foundation.template.json', template), ('voice-foundation-deployer-policy.json', policy)]:
    path = OUT / filename
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    assert json.loads(path.read_text()) == value
    print(f'Generated and parsed {filename}')
