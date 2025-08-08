import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Autocomplete,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import axios from "axios";

const endpointMapping = {
  Notion: "notion",
  Airtable: "airtable",
  Hubspot: "hubspot",
};

const hubspotOptions = ["contacts", "deals", "companies"];

export const DataForm = ({ integrationType, credentials }) => {
  const [loadedData, setLoadedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const endpoint = endpointMapping[integrationType];


  const loadData = async (objectTypeParam = null) => {
    if (!credentials) return;

    setLoading(true);
    try {
      const object_type = objectTypeParam ;

      const formData = new FormData();
      formData.append("credentials", JSON.stringify(credentials));
      if (object_type) formData.append("object_type", object_type);

      const response = await axios.post(
        `http://localhost:8000/integrations/${endpoint}/load`,
        formData
      );

      let data = response.data;

      setLoadedData(data);
    } catch (e) {
      alert(e?.response?.data?.detail || "Error loading data");
      setLoadedData([]);
    } finally {
      setLoading(false);
    }
  };

  // useEffect(() => {
  //   if (integrationType === "Hubspot") {
  //     loadData(selectedOption);
  //   }
  // }, [selectedOption]);

  const handleClear = () => {
    setLoadedData([]);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      width="100%"
      p={2}
    >
      {integrationType === "Hubspot" && (
        <Box width="300px" mb={2}>
          <Autocomplete
            disableClearable
            options={hubspotOptions}
            value={selectedOption}
            onChange={(_, newValue) => {
              setSelectedOption(newValue);
           
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Data Type"
                variant="outlined"
              />
            )}
          />
        </Box>
      )}

      <Box mb={2} display="flex" gap={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => loadData(selectedOption)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load Data"}
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={handleClear}
          disabled={loading}
        >
          Clear Data
        </Button>
      </Box>

      {loadedData.length === 0 ? (
        <Typography variant="body1" color="textSecondary">
          No data loaded.
        </Typography>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ maxHeight: 400, width: "100%" }}
        >
          <Table stickyHeader size="small" aria-label="integration items table">
            <TableHead>
              <TableRow>
                <TableCell>
                  <b>ID</b>
                </TableCell>
                <TableCell>
                  <b>Type</b>
                </TableCell>
                <TableCell>
                  <b>Name</b>
                </TableCell>
                <TableCell>
                  <b>Email</b>
                </TableCell>
                <TableCell>
                  <b>Directory</b>
                </TableCell>
                <TableCell>
                  <b>Visibility</b>
                </TableCell>
                <TableCell>
                  <b>Creation Time</b>
                </TableCell>
                <TableCell>
                  <b>Last Modified Time</b>
                </TableCell>
                <TableCell>
                  <b>URL</b>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>{item.directory ? "Yes" : "No"}</TableCell>
                  <TableCell>{item.visibility ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    {item.creation_time
                      ? new Date(item.creation_time).toLocaleString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {item.last_modified_time
                      ? new Date(item.last_modified_time).toLocaleString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.url}
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
