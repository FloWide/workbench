#!/bin/bash


tee /usr/share/nginx/html/assets/auth_config.json << END
{
    "url":"https://$SERVER.$DOMAIN/auth",
    "realm":"$SERVER",
    "clientId":"flowide-workbench"
}
END


tee /usr/share/nginx/html/assets/connector_list.json << END
{
    "api":{
        "api":"https://$SERVER.$DOMAIN/workbench-api",
        "streamlit_apps":"https://$SERVER.$DOMAIN/streamlit-cloud"
    },
    "dcm_connections":[
        {
            "location_name": "$SERVER",
            "api_base_url": "https://$SERVER.$DOMAIN"
        }
    ]
}
END

tee /etc/nginx/conf.d/default.conf << END
server {
    listen 80;
    listen [::]:80;

    location /docs {
        alias  /usr/share/nginx/html/docs;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
}
END