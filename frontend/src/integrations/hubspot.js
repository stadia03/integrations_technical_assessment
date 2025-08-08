import axios from "axios";
import { useState, useEffect } from "react";
import {
    Box,
    CircularProgress,
    Button,
} from '@mui/material';

export  function HubspotIntegration({
  user,
  org,
  integrationParams,
  setIntegrationParams,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      const formData = new FormData();

      formData.append("user_id", user);
      formData.append("org_id", org);

      const response = await axios.post(
        "http://localhost:8000/integrations/hubspot/authorize",
        formData
      );
      // console.log(response);

      const authURL = response?.data;

      const newWindow = window.open(
        authURL,
        "Hubspot Authorization",
        "width=600, height=600"
      );

      const pollTimer = window.setInterval(() => {
        if (newWindow?.closed === true) {
          window.clearInterval(pollTimer);
          handleWindowClosed();
        }
      }, 200);
    } catch (e) {
      setIsConnecting(false);
      alert(e?.response?.data?.detail);
    }
  };

 const handleWindowClosed = async () => {
        try {
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            const response = await axios.post(`http://localhost:8000/integrations/hubspot/credentials`, formData);
            const credentials = response.data; 
            if (credentials) {
                setIsConnecting(false);
                setIsConnected(true);
                setIntegrationParams(prev => ({ ...prev, credentials: credentials, type: 'Hubspot' }));
            }
            setIsConnecting(false);
        } catch (e) {
            setIsConnecting(false);
            alert(e?.response?.data?.detail);
        }
    }

  useEffect(() => {
    setIsConnected(integrationParams?.credentials && integrationParams?.type==='Hubspot' ? true : false);
  }, []);

  return(
    <>
     
            <Box display='flex' alignItems='center' justifyContent='center' gap={4}>
                <Button 
                    variant='contained' 
                    onClick={isConnected ? () => {} :handleConnectClick}
                    color={isConnected ? 'success' : 'primary'}
                    disabled={isConnecting}
                    style={{
                        pointerEvents: isConnected ? 'none' : 'auto',
                        cursor: isConnected ? 'default' : 'pointer',
                        opacity: isConnected ? 1 : undefined
                    }}
                >
                    {isConnected ? 'Hubspot Connected' : isConnecting ? <CircularProgress size={20} /> : 'Connect to Hubspot'}
                </Button>
                <Button
                variant='contained'
                color='error'
                disabled={isConnected? false : true}
                onClick={()=>{
                  setIntegrationParams(null);
                  setIsConnected(false);
                  setIsConnecting(false);
                }}
                >
                  Disconnect Hubspot
                </Button>
            </Box>
    
    </>
  )
}
