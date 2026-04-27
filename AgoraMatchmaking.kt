import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import io.agora.rtc2.ChannelMediaOptions
import io.agora.rtc2.Constants
import io.agora.rtc2.RtcEngine
import java.util.UUID

// Assume mRtcEngine and token are defined elsewhere or passed in
// private var mRtcEngine: RtcEngine? = null
// private var token: String? = null

object AgoraMatchmaking {

    private val db = FirebaseFirestore.getInstance()
    private var currentChannel: String = ""
    private var isJoined = false
    
    // Global variables for queue management
    var myQueueId: String? = null
    var listener: ListenerRegistration? = null

    // Reference to your RtcEngine and Token (Set these from your Activity/Fragment)
    var mRtcEngine: RtcEngine? = null
    var token: String? = null

    //----------------------------------
    // 1. SAFE AGORA CONNECTION
    //----------------------------------
    fun joinAgoraChannel(channel: String) {
        if (channel.isEmpty() || isJoined) return

        try {
            val options = ChannelMediaOptions()
            options.clientRoleType = Constants.CLIENT_ROLE_BROADCASTER
            options.channelProfile = Constants.CHANNEL_PROFILE_COMMUNICATION

            mRtcEngine?.joinChannel(token, channel, 0, options)
            currentChannel = channel
            isJoined = true
            Log.d("AgoraMatchmaking", "Joined channel: $channel")
        } catch (e: Exception) {
            e.printStackTrace()
            Log.e("AgoraMatchmaking", "Error joining channel", e)
        }
    }

    fun leaveAgora() {
        try {
            mRtcEngine?.leaveChannel()
            isJoined = false
            currentChannel = ""
            Log.d("AgoraMatchmaking", "Left channel successfully")
        } catch (e: Exception) {
            e.printStackTrace()
            Log.e("AgoraMatchmaking", "Error leaving channel", e)
        }
    }

    //----------------------------------
    // 2. MATCHMAKING SYSTEM (SAFE)
    //----------------------------------
    fun findMatch() {
        val queueRef = db.collection("queue")

        queueRef.whereEqualTo("status", "waiting")
            .get()
            .addOnSuccessListener { snapshot ->
                if (!snapshot.isEmpty) {
                    // Match found
                    val other = snapshot.documents[0]
                    val channel = "room_" + System.currentTimeMillis()

                    // Update the waiting user's status
                    queueRef.document(other.id).update(
                        mapOf(
                            "status" to "matched",
                            "channel" to channel
                        )
                    ).addOnSuccessListener {
                        // Add myself as matched
                        val myData = hashMapOf(
                            "uid" to UUID.randomUUID().toString(),
                            "status" to "matched",
                            "channel" to channel,
                            "createdAt" to System.currentTimeMillis()
                        )

                        queueRef.add(myData).addOnSuccessListener { docRef ->
                            myQueueId = docRef.id
                            joinAgoraChannel(channel)
                        }.addOnFailureListener { e ->
                            Log.e("AgoraMatchmaking", "Failed to add self to queue", e)
                        }
                    }.addOnFailureListener { e ->
                        Log.e("AgoraMatchmaking", "Failed to update other user", e)
                    }

                } else {
                    // No match found, enqueue myself
                    val myData = hashMapOf(
                        "uid" to UUID.randomUUID().toString(),
                        "status" to "waiting",
                        "channel" to null,
                        "createdAt" to System.currentTimeMillis()
                    )

                    queueRef.add(myData).addOnSuccessListener { docRef ->
                        myQueueId = docRef.id
                        listenMatch(docRef.id)
                    }.addOnFailureListener { e ->
                        Log.e("AgoraMatchmaking", "Failed to add waiting queue", e)
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.e("AgoraMatchmaking", "Failed to query queue", e)
            }
    }

    //----------------------------------
    // 3. LISTEN FOR MATCH
    //----------------------------------
    fun listenMatch(docId: String) {
        // ALWAYS remove existing listener to prevent duplicates
        listener?.remove()

        listener = db.collection("queue")
            .document(docId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e("AgoraMatchmaking", "Listen failed.", error)
                    return@addSnapshotListener
                }

                val data = snapshot?.data
                if (data != null && data["status"] == "matched") {
                    val channel = data["channel"] as? String
                    if (!channel.isNullOrEmpty()) {
                        joinAgoraChannel(channel)
                    }
                }
            }
    }

    //----------------------------------
    // 4. NEXT MATCH
    //----------------------------------
    fun nextMatch() {
        myQueueId?.let {
            db.collection("queue").document(it).delete()
                .addOnSuccessListener { Log.d("AgoraMatchmaking", "Deleted queue document") }
                .addOnFailureListener { e -> Log.e("AgoraMatchmaking", "Failed to delete queue doc", e) }
        }

        leaveAgora()
        
        // Remove listener before finding a new match
        listener?.remove()
        listener = null
        
        findMatch()
    }

    //----------------------------------
    // 5. LEAVE CHAT
    //----------------------------------
    fun leaveChat() {
        myQueueId?.let {
            db.collection("queue").document(it).delete()
                .addOnSuccessListener { Log.d("AgoraMatchmaking", "Deleted queue document on leave") }
                .addOnFailureListener { e -> Log.e("AgoraMatchmaking", "Failed to delete queue doc on leave", e) }
        }

        leaveAgora()
        listener?.remove()
        listener = null
        myQueueId = null
    }

}
