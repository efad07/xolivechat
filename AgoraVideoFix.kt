import android.view.SurfaceView
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import io.agora.rtc2.ChannelMediaOptions
import io.agora.rtc2.Constants
import io.agora.rtc2.IRtcEngineEventHandler
import io.agora.rtc2.RtcEngine
import io.agora.rtc2.video.VideoCanvas

// This is a reference implementation for your Android project.
// You can integrate this directly into your Video Calling Activity or Fragment.
abstract class AgoraVideoFixActivity : AppCompatActivity() {

    protected var mRtcEngine: RtcEngine? = null
    private var isJoined = false
    private var currentChannel: String = ""

    //----------------------------------
    // 4. JOIN SUCCESS HANDLER
    //----------------------------------
    protected val mRtcEventHandler = object : IRtcEngineEventHandler() {
        override fun onJoinChannelSuccess(channel: String?, uid: Int, elapsed: Int) {
            runOnUiThread {
                showToast("Joined: $channel")
                // Start video AFTER join to prevent lobby permission crashes
                setupLocalVideo() 
            }
        }

        override fun onUserJoined(uid: Int, elapsed: Int) {
            runOnUiThread {
                setupRemoteVideo(uid)
            }
        }
        
        override fun onUserOffline(uid: Int, reason: Int) {
            runOnUiThread {
                // Clear remote video when user leaves
                findViewById<FrameLayout>(resources.getIdentifier("remote_video_view_container", "id", packageName))?.removeAllViews()
            }
        }
    }

    //----------------------------------
    // 3. SAFE AGORA JOIN FUNCTION
    //----------------------------------
    fun joinAgoraChannel(channel: String) {
        if (channel.isEmpty() || isJoined) return

        val options = ChannelMediaOptions()
        options.clientRoleType = Constants.CLIENT_ROLE_BROADCASTER
        options.channelProfile = Constants.CHANNEL_PROFILE_COMMUNICATION

        mRtcEngine?.enableVideo()
        
        // CRITICAL FIX: DO NOT call mRtcEngine?.startPreview() here!

        mRtcEngine?.joinChannel(null, channel, 0, options)

        currentChannel = channel
        isJoined = true
    }

    //----------------------------------
    // 5. LOCAL VIDEO SETUP (SAFE)
    //----------------------------------
    private fun setupLocalVideo() {
        // Using dynamic identifier to avoid requiring the exact R.id import in this standalone file
        val containerId = resources.getIdentifier("local_video_view_container", "id", packageName)
        val container = findViewById<FrameLayout>(containerId)
        
        container?.removeAllViews()

        val surfaceView = SurfaceView(this)
        container?.addView(surfaceView)

        mRtcEngine?.setupLocalVideo(
            VideoCanvas(surfaceView, VideoCanvas.RENDER_MODE_HIDDEN, 0)
        )
    }

    //----------------------------------
    // 6. REMOTE VIDEO (SAFE)
    //----------------------------------
    private fun setupRemoteVideo(uid: Int) {
        val containerId = resources.getIdentifier("remote_video_view_container", "id", packageName)
        val container = findViewById<FrameLayout>(containerId)
        
        container?.removeAllViews()

        val surfaceView = SurfaceView(this)
        surfaceView.setZOrderMediaOverlay(true)
        container?.addView(surfaceView)

        mRtcEngine?.setupRemoteVideo(
            VideoCanvas(surfaceView, VideoCanvas.RENDER_MODE_HIDDEN, uid)
        )
    }

    //----------------------------------
    // 7. SAFE LEAVE FUNCTION
    //----------------------------------
    fun leaveAgora() {
        try {
            mRtcEngine?.leaveChannel()
            isJoined = false
            currentChannel = ""
            
            // Optional: clean up video views on leave
            findViewById<FrameLayout>(resources.getIdentifier("local_video_view_container", "id", packageName))?.removeAllViews()
            findViewById<FrameLayout>(resources.getIdentifier("remote_video_view_container", "id", packageName))?.removeAllViews()
            
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
}
