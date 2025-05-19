const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Convert seconds to MM:SS format
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Get video info
app.get('/info', async (req, res) => {
  const url = req.query.url;
  console.log('Received /info request for URL:', url);

  if (!url || !ytdl.validateURL(url)) {
    console.error('Invalid YouTube URL:', url);
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const info = await ytdl.getInfo(url, { requestOptions: { maxRetries: 3, backoff: { inc: 100, max: 1000 } } });
    console.log('Video info retrieved:', info.videoDetails.title);

    const formats = info.formats
      .filter(f => f.hasVideo && f.hasAudio && f.container === 'mp4')
      .map(f => ({
        itag: f.itag,
        resolution: f.qualityLabel || 'Unknown',
        size: f.contentLength ? `${(f.contentLength / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
      }))
      .sort((a, b) => {
        const resA = parseInt(a.resolution) || 0;
        const resB = parseInt(b.resolution) || 0;
        return resB - resA;
      });

    if (!formats.length) {
      console.error('No suitable formats found for URL:', url);
      return res.status(404).json({ error: 'No downloadable formats found' });
    }

    res.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      duration: formatDuration(info.videoDetails.lengthSeconds),
      formats,
    });
  } catch (error) {
    console.error('Error fetching video info:', error.message);
    res.status(500).json({ error: `Error fetching video info: ${error.message}` });
  }
});

// Download video
app.get('/download', async (req, res) => {
  const url = req.query.url;
  const itag = req.query.itag;
  console.log('Received /download request for URL:', url, 'itag:', itag);

  if (!url || !ytdl.validateURL(url) || !itag) {
    console.error('Invalid URL or itag:', { url, itag });
    return res.status(400).send('Invalid URL or format');
  }

  try {
    const info = await ytdl.getInfo(url);
    const safeTitle = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `JoyStream_${safeTitle}.mp4`;

    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    ytdl(url, { quality: itag, filter: 'videoandaudio' }).pipe(res);

    console.log('Streaming video:', filename);
  } catch (error) {
    console.error('Error downloading video:', error.message);
    res.status(500).send(`Error downloading video: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});
